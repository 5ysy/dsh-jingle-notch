import { psQuote } from './process-utils.ts'
/**
 * Chime playback for approval, question, and finish moments uses platform
 * system sounds or a configured audio file. Child processes play the audio
 * asynchronously so notifications do not block the Host.
 */
import { spawn, type ChildProcess } from 'node:child_process'

/** Deadline for the player child process, in milliseconds. */
const SOUND_TIMEOUT_MS = 15_000

/** The three moments a chime can mark. */
export type SoundKind = 'approval' | 'question' | 'finish'

/** System sound per platform per moment; empty arrays mean "no default". */
const SYSTEM_SOUNDS: Record<SoundKind, Record<string, string[]>> = {
  approval: {
    darwin: ['/System/Library/Sounds/Ping.aiff'],
    linux: ['/usr/share/sounds/freedesktop/stereo/message.oga', '/usr/share/sounds/freedesktop/stereo/bell.oga'],
    win32: ['C:\\Windows\\Media\\Windows Notify.wav', 'C:\\Windows\\Media\\notify.wav'],
  },
  question: {
    darwin: ['/System/Library/Sounds/Pop.aiff'],
    linux: ['/usr/share/sounds/freedesktop/stereo/dialog-information.oga', '/usr/share/sounds/freedesktop/stereo/bell.oga'],
    win32: ['C:\\Windows\\Media\\Speech On.wav', 'C:\\Windows\\Media\\notify.wav'],
  },
  finish: {
    darwin: ['/System/Library/Sounds/Glass.aiff'],
    linux: ['/usr/share/sounds/freedesktop/stereo/complete.oga', '/usr/share/sounds/freedesktop/stereo/service-logout.oga'],
    win32: ['C:\\Windows\\Media\\tada.wav'],
  },
}

export interface SoundPlayer {
  play(kind: SoundKind): void
}

export function createSoundPlayer(options: { file?: string }, log: (message: string) => void): SoundPlayer {
  return {
    play(kind: SoundKind): void {
      try {
        run(options, kind, log)
      } catch (error: unknown) {
        log(`sound playback failed: ${String(error)}`)
      }
    },
  }
}

function run(options: { file?: string }, kind: SoundKind, log: (message: string) => void): void {
  const platform = process.platform
  const candidates = options.file !== undefined && options.file.length > 0 ? [options.file] : (SYSTEM_SOUNDS[kind][platform] ?? [])
  if (candidates.length === 0) {
    log(`no system sound for ${kind} on ${platform}`)
    return
  }
  if (platform === 'darwin') {
    finish(spawn('afplay', [candidates[0]], { stdio: 'ignore' }), log)
    return
  }
  if (platform === 'linux') {
    // paplay speaks the freedesktop OGA set; aplay covers bare WAV installs.
    finish(spawn('paplay', [candidates[0]], { stdio: 'ignore' }), log, () => {
      finish(spawn('aplay', ['-q', candidates[0]], { stdio: 'ignore' }), log)
    })
    return
  }
  if (platform === 'win32') {
    const script = `(New-Object Media.SoundPlayer ${psQuote(candidates[0])}).PlaySync()`
    finish(spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: 'ignore' }), log)
    return
  }
  log(`no sound player on ${platform}`)
}

function finish(proc: ChildProcess, log: (message: string) => void, onFail?: () => void): void {
  let failed = false
  const fail = (message: string): void => {
    if (failed) return
    failed = true
    log(message)
    onFail?.()
  }
  proc.on('error', (error: NodeJS.ErrnoException) => {
    fail(`sound player spawn failed: ${error.message}`)
  })
  const timer = setTimeout(() => {
    proc.kill()
  }, SOUND_TIMEOUT_MS)
  proc.once('close', (code, signal) => {
    clearTimeout(timer)
    if (code !== 0) fail(`sound player exited: code=${code}, signal=${signal ?? 'none'}`)
  })
}
