/**
 * JingleNotch command surface: the `/jingle` slash command summarizes the
 * companion state directly in an interactive UI, without a model round trip;
 * `/jingle overlay` launches the notch overlay when the composition has a
 * webserver. The row declares `inject: [jingleNotch, commands]`.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from './events.ts'
import type { CommandInvocationLike, CommandResultLike } from './host-views.ts'

export const name = 'jingle-notch-commands'
export const inject = ['jingleNotch', 'commands']

export function apply(ctx: Context): void {
  const handler = (invocation: CommandInvocationLike): CommandResultLike => {
    const argument = invocation.rawInput?.trim() ?? ''
    if (argument === 'overlay stop' || argument === '浮窗 退出') {
      const result = ctx.jingleNotch.stopOverlay()
      return { kind: result.ok ? 'success' : 'error', text: `JingleNotch ${result.message}` }
    }
    if (argument === 'overlay' || argument === '浮窗') {
      const webServer = ctx.get('webServer')
      if (webServer === undefined) {
        return { kind: 'error', text: 'JingleNotch overlay: needs a composition with the web GUI server' }
      }
      if (!ctx.jingleNotch.configuration.overlay.enabled) {
        return { kind: 'error', text: 'JingleNotch overlay: disabled by config (overlay.enabled)' }
      }
      const result = ctx.jingleNotch.startOverlay(webServer.getOrigin())
      return { kind: result.ok ? 'success' : 'error', text: `JingleNotch ${result.message}` }
    }
    return { kind: 'success', text: statusText(ctx.jingleNotch.snapshot()) }
  }
  ctx.commands.register({
    name: 'jingle',
    description: 'Show JingleNotch status or control its notch overlay',
    input: { hint: '[overlay [stop]]' },
    handler,
  })
}

/** One-line-per-pill status summary; also used by tests. */
export function statusText(snapshot: ReturnType<import('./index.ts').JingleNotchService['snapshot']>): string {
  const lines: string[] = []
  const sessions = snapshot.sessions
  if (sessions.length === 0) {
    lines.push('JingleNotch: no live sessions — Jingle is asleep.')
  } else {
    lines.push(`JingleNotch: ${sessions.length} session${sessions.length === 1 ? '' : 's'}`)
    for (const pill of sessions) {
      const tool = pill.currentTool === undefined ? '' : ` — ${pill.currentTool}`
      lines.push(`  [${pill.state}] ${pill.label} · ${pill.stats.turns} turns · ${pill.stats.toolCalls} tools${tool}`)
    }
  }
  if (snapshot.approvals.length > 0) {
    lines.push(`waiting on you: ${snapshot.approvals.map((approval) => approval.toolName).join(', ')}`)
  }
  if (snapshot.questions.length > 0) {
    lines.push(`questions open: ${snapshot.questions.length}`)
  }
  const totals = snapshot.totals
  lines.push(
    `today: ${totals.sessionsToday} sessions · ${totals.turns} turns · ${totals.toolCalls} tool calls` +
      (totals.approvalsAutoAllowed > 0 ? ` · ${totals.approvalsAutoAllowed} auto-allowed` : ''),
  )
  return lines.join('\n')
}
