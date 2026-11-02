import { describe, expect, it } from 'vitest'
import { OverlayApprovals } from '../src/overlay-approvals.ts'

describe('overlay decision channel', () => {
  it('delivers a surface decision to the waiting answerer', async () => {
    const channel = new OverlayApprovals()
    const waiting = channel.wait('a1', undefined)
    expect(channel.size).toBe(1)
    expect(channel.answer('a1', 'allowed-once')).toBe(true)
    await expect(waiting).resolves.toBe('allowed-once')
    expect(channel.size).toBe(0)
  })

  it('maps "always" to allowed-once', async () => {
    const channel = new OverlayApprovals()
    const waiting = channel.wait('a2', undefined)
    channel.answer('a2', 'always')
    await expect(waiting).resolves.toBe('allowed-once')
  })

  it('settles cancelled when the request aborts', async () => {
    const channel = new OverlayApprovals()
    const controller = new AbortController()
    const waiting = channel.wait('a3', controller.signal)
    controller.abort()
    await expect(waiting).resolves.toBe('cancelled')
    expect(channel.size).toBe(0)
  })

  it('settles immediately when the signal was already aborted', async () => {
    const channel = new OverlayApprovals()
    const controller = new AbortController()
    controller.abort()
    await expect(channel.wait('already-aborted', controller.signal)).resolves.toBe('cancelled')
    expect(channel.size).toBe(0)
  })

  it('reports unknown ids and drops entries when another answerer claims', async () => {
    const channel = new OverlayApprovals()
    expect(channel.answer('ghost', 'rejected')).toBe(false)
    const waiting = channel.wait('a4', undefined)
    channel.cancel('a4')
    await expect(waiting).resolves.toBe('cancelled')
    // A late answer after cancellation finds nothing.
    expect(channel.answer('a4', 'allowed-once')).toBe(false)
  })

  it('dispose settles every pending waiter', async () => {
    const channel = new OverlayApprovals()
    const waiting = Promise.all([channel.wait('b1', undefined), channel.wait('b2', undefined)])
    channel.dispose()
    await expect(waiting).resolves.toEqual(['cancelled', 'cancelled'])
  })
})
