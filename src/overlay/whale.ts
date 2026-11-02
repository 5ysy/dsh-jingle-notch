import type { PillState } from '../types.ts'

export function compactWhaleState(sessions: ReadonlyArray<{ state: PillState }>, pending: boolean): PillState {
  if (pending || sessions.some(session => session.state === 'attention')) return 'attention'
  for (const state of ['error', 'working', 'thinking', 'finished'] as const) {
    if (sessions.some(session => session.state === state)) return state
  }
  return 'idle'
}
