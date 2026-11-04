import type { Context } from '@deepseek-ai/cordis'
import { expect, it, vi } from 'vitest'
import { apply } from '../src/commands.ts'
import type { CommandInvocationLike, CommandResultLike } from '../src/host-views.ts'

it('registers /jingle for status without exposing overlay process controls', () => {
  const handlers = new Map<string, (input: CommandInvocationLike) => CommandResultLike>()
  const stopOverlay = vi.fn(() => ({ ok: true, message: 'overlay: stopping' }))
  const startOverlay = vi.fn(() => ({ ok: true, message: 'overlay: launched' }))
  const snapshot = () => ({ sessions: [], approvals: [], questions: [], totals: {} })
  apply({ commands: { register: (definition: { name: string; handler: (input: CommandInvocationLike) => CommandResultLike }) => {
    handlers.set(definition.name, definition.handler)
    return () => {}
  } }, jingleNotch: { stopOverlay, startOverlay, snapshot, configuration: { overlay: { enabled: true } } },
  get: () => ({ getOrigin: () => 'http://127.0.0.1:3080' }),
  } as unknown as Context)
  expect([...handlers.keys()]).toEqual(['jingle'])
  const handler = handlers.get('jingle')!
  expect(handler({}).text).toContain('JingleNotch: no live sessions — Jingle is asleep.')
  expect(handler({ rawInput: 'overlay' }).text).toContain('JingleNotch: no live sessions')
  expect(handler({ rawInput: 'overlay stop' }).text).toContain('JingleNotch: no live sessions')
  expect(startOverlay).not.toHaveBeenCalled()
  expect(stopOverlay).not.toHaveBeenCalled()
})
