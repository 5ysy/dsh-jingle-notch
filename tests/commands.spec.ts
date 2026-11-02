import type { Context } from '@deepseek-ai/cordis'
import { expect, it, vi } from 'vitest'
import { apply } from '../src/commands.ts'
import type { CommandInvocationLike, CommandResultLike } from '../src/host-views.ts'

it('stops the overlay without requiring a webserver or launching a new process', () => {
  const stopOverlay = vi.fn(() => ({ ok:true, message:'overlay: stopping' }))
  const startOverlay = vi.fn()
  const snapshot = vi.fn(() => ({sessions:[],approvals:[],questions:[],totals:{}}))
  let handler!: (input: CommandInvocationLike) => CommandResultLike
  apply({commands:{register:(definition: {handler: typeof handler}) => {handler=definition.handler;return ()=>{}}},
    jingleNotch:{stopOverlay,startOverlay,snapshot},get:()=>undefined,
  } as unknown as Context)
  expect(handler({rawInput:'overlay stop'})).toEqual({kind:'success',text:'JingleNotch overlay: stopping'})
  expect(stopOverlay).toHaveBeenCalledOnce()
  expect(startOverlay).not.toHaveBeenCalled()
})

it('registers only /jingle for status and overlay controls', () => {
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
  expect(handler({ rawInput: 'overlay' })).toEqual({ kind: 'success', text: 'JingleNotch overlay: launched' })
  expect(handler({ rawInput: 'overlay stop' })).toEqual({ kind: 'success', text: 'JingleNotch overlay: stopping' })
  expect(startOverlay).toHaveBeenCalledWith('http://127.0.0.1:3080')
  expect(startOverlay).toHaveBeenCalledOnce()
  expect(stopOverlay).toHaveBeenCalledOnce()
})
