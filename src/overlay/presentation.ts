import type { PillState } from '../types.ts'

export interface OverlayRequest { key: string; sessionId?: string; at: number }

/** Validate the small host subset used for request routing and presentation. */
export function actionableOverlayRequests(snapshot: { approvals?: unknown; questions?: unknown }): OverlayRequest[] {
  const result: OverlayRequest[] = []
  for (const kind of ['approvals','questions'] as const) {
    const entries = snapshot[kind]
    if (!Array.isArray(entries)) continue
    for (const value of entries) {
      if (!value || typeof value !== 'object' || Array.isArray(value) || value.answerable === false || value.replyQueued === true) continue
      const sessionId = typeof value.sessionId === 'string' && value.sessionId ? value.sessionId : undefined
      const at = typeof value.at === 'number' && Number.isFinite(value.at) ? value.at : 0
      if (kind === 'approvals' && typeof value.id === 'string' && value.id) result.push({ key:JSON.stringify(['a',value.id]), sessionId, at })
      if (kind === 'questions' && sessionId && typeof value.callId === 'string' && value.callId) result.push({ key:JSON.stringify(['q',sessionId,value.callId]), sessionId, at })
    }
  }
  return result.sort((a,b) => b.at - a.at || a.key.localeCompare(b.key))
}

/** Running sessions stay ahead of inactive history, independently of arrival order. */
export function orderOverlaySessions<T extends { id: string; state: PillState; lastActivityAt: number }>(sessions: readonly T[], requests: readonly { sessionId?: string }[]): T[] {
  const waiting = new Set(requests.map(request => request.sessionId))
  const rank = (session: T): number => waiting.has(session.id) || session.state === 'attention' ? 0
    : session.state === 'working' || session.state === 'thinking' ? 1 : session.state === 'error' ? 2 : 3
  const time = (session: T): number => Number.isFinite(session.lastActivityAt) ? session.lastActivityAt : 0
  return [...sessions].sort((a,b) => rank(a) - rank(b) || time(b) - time(a) || a.id.localeCompare(b.id))
}

/** Stable hues avoid color changes when keyed session nodes move in the list. */
export function sessionHue(id: string): number {
  let hash = 2166136261
  for (let index = 0; index < id.length; index++) hash = Math.imul(hash ^ id.charCodeAt(index), 16777619)
  return (hash >>> 0) % 360
}
