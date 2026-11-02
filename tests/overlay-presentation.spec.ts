import { describe, expect, it } from 'vitest'
import { actionableOverlayRequests, orderOverlaySessions, sessionHue } from '../src/overlay/presentation.ts'

describe('actionable request presentation', () => {
  it('includes only requests that still accept a reply', () => {
    const requests = actionableOverlayRequests({
      approvals:[{id:'yes', sessionId:'api', at:20}, {id:'delegated', answerable:false}, null],
      questions:[{sessionId:'web',callId:'ask',at:30}, {sessionId:'web',callId:'queued',replyQueued:true},
        {sessionId:'web',callId:'delegated',answerable:false}, {sessionId:'web'}, null],
    })
    expect(requests.map(request => request.sessionId)).toEqual(['web','api'])
    expect(new Set(requests.map(request => request.key)).size).toBe(2)
    expect(actionableOverlayRequests({approvals:'invalid',questions:[]})).toEqual([])
  })

  it('uses unambiguous identities for opaque request IDs', () => {
    const requests = actionableOverlayRequests({questions:[
      {sessionId:'a:b',callId:'c'}, {sessionId:'a',callId:'b:c'},
    ]})
    expect(requests[0].key).not.toBe(requests[1].key)
  })

  it('puts pending and running sessions above old inactive sessions without mutating input', () => {
    const sessions = [
      {id:'old',state:'idle' as const,lastActivityAt:1},
      {id:'done',state:'finished' as const,lastActivityAt:100},
      {id:'api',state:'working' as const,lastActivityAt:20},
      {id:'web',state:'thinking' as const,lastActivityAt:30},
      {id:'pending',state:'attention' as const,lastActivityAt:2},
      {id:'failed',state:'error' as const,lastActivityAt:50},
    ]
    expect(orderOverlaySessions(sessions,[{sessionId:'pending'}]).map(session=>session.id)).toEqual([
      'pending','web','api','failed','done','old',
    ])
    expect(sessions[0].id).toBe('old')
    expect(orderOverlaySessions([{...sessions[0],lastActivityAt:NaN},sessions[1]],[])[0].id).toBe('done')
  })

  it('keeps each session color stable across sorting and polling', () => {
    const ids = ['api','web','tests','smoke','idle-1','idle-2']
    expect(new Set(ids.map(sessionHue)).size).toBe(ids.length)
    for (const id of ids) {
      expect(sessionHue(id)).toBe(sessionHue(id))
      expect(sessionHue(id)).toBeGreaterThanOrEqual(0)
      expect(sessionHue(id)).toBeLessThan(360)
    }
  })
})
