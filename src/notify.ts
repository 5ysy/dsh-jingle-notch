import { psQuote } from './process-utils.ts'
/**
 * Cross-platform desktop notifications, fired and forgotten: a notification
 * that fails or stalls must never slow the agent turn that triggered it.
 * Every spawn runs detached from the plugin's control flow, dies at a short
 * deadline, and reports failures through the plugin logger.
 */
import { spawn, type ChildProcess } from 'node:child_process'

/** Deadline for the notifier child process, in milliseconds. */
const NOTIFICATION_TIMEOUT_MS = 10_000

export interface Notifier {
  send(title: string, body: string): void
}

/** Real notifier that shells out to the platform's native mechanism. */
export function createNotifier(log: (message: string) => void): Notifier {
  return {
    send(title: string, body: string): void {
      try {
        run(log, title, body)
      } catch (error: unknown) {
        log(`notification failed: ${String(error)}`)
      }
    },
  }
}

/** Notifier that records every send for tests and dry runs. */
export function createRecordingNotifier(sent: { title: string; body: string }[]): Notifier {
  return {
    send(title: string, body: string): void {
      sent.push({ title, body })
    },
  }
}

function run(log: (message: string) => void, title: string, body: string): void {
  const platform = process.platform
  if (platform === 'darwin') {
    // AppleScript quoting: backslash and double quote are the escape set.
    const escape = (text: string): string => text.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
    finish(spawn('osascript', ['-e', `display notification "${escape(body)}" with title "${escape(title)}"`], { stdio: 'ignore' }), log)
    return
  }
  if (platform === 'linux') {
    finish(spawn('notify-send', [title, body], { stdio: 'ignore' }), log)
    return
  }
  if (platform === 'win32') {
    // WinRT toast through PowerShell; a host without desktop notifications
    // (service sessions, stripped images) logs the failure and moves on.
    const script = [
      '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null',
      '$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)',
      `$text = $template.GetElementsByTagName("text"); $text.Item(0).AppendChild($template.CreateTextNode(${psQuote(title)})) | Out-Null; $text.Item(1).AppendChild($template.CreateTextNode(${psQuote(body)})) | Out-Null`,
      '$toast = [Windows.UI.Notifications.ToastNotification]::new($template)',
      '[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("dsh-jingle-notch").Show($toast)',
    ].join('; ')
    finish(spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: 'ignore' }), log)
    return
  }
  log(`no desktop notification mechanism on ${platform}`)
}

function finish(proc: ChildProcess, log: (message: string) => void): void {
  proc.on('error', (error: NodeJS.ErrnoException) => {
    log(`notifier spawn failed: ${error.message}`)
  })
  const timer = setTimeout(() => {
    proc.kill()
  }, NOTIFICATION_TIMEOUT_MS)
  proc.once('close', (code, signal) => {
    if (code !== 0) log(`notifier exited: code=${code}, signal=${signal ?? 'none'}`)
    clearTimeout(timer)
  })
}
