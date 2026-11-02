import { describe, expect, it } from 'vitest'
import { CompanionRegistry, basename, dateKey, describeQuestion, describeToolCall, firstText, oneLine } from '../src/companion.ts'
import type { SessionEventLike, SessionLike } from '../src/types.ts'

const SESSION: SessionLike = { id: 'sess-1234567890', header: { cwd: '/home/dev/my-project' } }

function event(type: string, data: unknown, seq = 1, time = 1000): SessionEventLike {
  return { type, seq, time, data }
}

/** A registry with hold timers recorded instead of fired; tests advance state manually. */
function makeRegistry(): { registry: CompanionRegistry; timers: ReturnType<typeof setTimeout>[] } {
  const timers: ReturnType<typeof setTimeout>[] = []
  const registry = new CompanionRegistry({ tickerSize: 3, finishedHoldMs: 5000 }, (timer) => timers.push(timer))
  return { registry, timers }
}

describe('pill lifecycle', () => {
  it('creates a pill labeled by workspace name on first event', () => {
    const { registry } = makeRegistry()
    registry.observeSession(SESSION, event('turn/start', { turn: 1 }), 1000)
    const pills = registry.list()
    expect(pills).toHaveLength(1)
    expect(pills[0]?.label).toBe('my-project')
    expect(pills[0]?.state).toBe('thinking')
  })

  it('falls back to an id-prefix label without cwd', () => {
    const { registry } = makeRegistry()
    registry.observeSession({ id: 'abcdefghij' }, event('turn/start', { turn: 1 }), 1000)
    expect(registry.list()[0]?.label).toBe('session abcdefgh')
  })

  it('moves thinking → working on tool calls and records the ticker', () => {
    const { registry } = makeRegistry()
    registry.observeSession(SESSION, event('turn/start', { turn: 1 }), 1000)
    registry.observeSession(
      SESSION,
      event('tool/call', { callId: 'c1', name: 'bash', arguments: JSON.stringify({ command: 'npm test' }) }),
      2000,
    )
    const pill = registry.list()[0]
    expect(pill?.state).toBe('working')
    expect(pill?.currentTool).toBe('bash npm test')
    expect(pill?.ticker.at(-1)?.kind).toBe('tool')
  })

  it('records direct user and assistant message payloads', () => {
    const { registry } = makeRegistry()
    registry.observeSession(SESSION, event('user/message', { content: [{ type: 'text', text: 'Build it' }] }), 1000)
    registry.observeSession(SESSION, event('assistant/message', { message: { content: [{ type: 'text', text: 'Done' }] } }), 2000)
    expect(registry.list()[0]?.ticker.map((entry) => entry.kind)).toEqual(['prompt', 'response'])
  })

  it('marks a completed turn finished and holds before idle', () => {
    const { registry, timers } = makeRegistry()
    registry.observeSession(SESSION, event('turn/start', { turn: 1 }), 1000)
    registry.observeSession(SESSION, event('turn/end', { turn: 1, reason: { kind: 'completed' } }), 2000)
    expect(registry.list()[0]?.state).toBe('finished')
    expect(timers).toHaveLength(1)
    // An intervening event cancels the hold.
    registry.observeSession(SESSION, event('turn/start', { turn: 2 }), 3000)
    expect(registry.list()[0]?.state).toBe('thinking')
  })

  it('marks a failed turn error', () => {
    const { registry } = makeRegistry()
    registry.observeSession(SESSION, event('turn/end', { turn: 1, reason: { kind: 'error', error: {} } }), 1000)
    expect(registry.list()[0]?.state).toBe('error')
  })

  it('returns aborted turns to idle without a hold', () => {
    const { registry, timers } = makeRegistry()
    registry.observeSession(SESSION, event('turn/start', { turn: 1 }), 1000)
    registry.observeSession(SESSION, event('turn/end', { turn: 1, reason: { kind: 'aborted', reason: 'user' } }), 2000)
    expect(registry.list()[0]?.state).toBe('idle')
    expect(timers).toHaveLength(0)
  })

  it('drops the pill when the session disposes', () => {
    const { registry } = makeRegistry()
    registry.observeSession(SESSION, event('turn/start', { turn: 1 }), 1000)
    registry.sessionDisposed(SESSION)
    expect(registry.list()).toHaveLength(0)
  })
})

describe('question tracking', () => {
  it('opens and closes a pending question around the tool call', () => {
    const { registry } = makeRegistry()
    registry.observeSession(
      SESSION,
      event('tool/call', { callId: 'q1', name: 'ask_user_question', arguments: JSON.stringify({ questions: [{ id: 'framework', question: 'Use React or Vue?', options: [{ label: 'React' }, { label: 'Vue' }] }] }) }),
      1000,
    )
    expect(registry.questions()).toHaveLength(1)
    expect(registry.questions()[0]?.preview).toBe('Use React or Vue?')
    expect(registry.questions()[0]?.questions?.[0]?.options?.map((option) => option.label)).toEqual(['React', 'Vue'])
    expect(registry.list()[0]?.state).toBe('attention')
    registry.observeSession(SESSION, event('tool/result', { message: { toolCallId: 'q1' } }), 2000)
    expect(registry.questions()).toHaveLength(0)
    expect(registry.list()[0]?.state).toBe('working')
  })

  it('keeps a timed question open when its tool result reports pending', () => {
    const { registry } = makeRegistry()
    registry.observeSession(SESSION, event('tool/call', {
      callId: 'timed-q', name: 'ask_user_question', arguments: JSON.stringify({ questions: [{ id: 'q', question: 'Continue?', options: [{ label: 'Yes' }] }] }),
    }), 1000)
    registry.observeSession(SESSION, event('tool/result', {
      message: {
        toolCallId: 'timed-q',
        content: [{ type: 'text', text: JSON.stringify({ pending: true, callId: 'timed-q' }) }],
      },
    }), 2000)
    expect(registry.questions()).toHaveLength(1)
    expect(registry.list()[0]?.state).toBe('attention')
  })
})

describe('file change summaries', () => {
  it('records bounded diff statistics from a tool result', () => {
    const { registry } = makeRegistry()
    registry.observeSession(SESSION, event('tool/call', { callId: 'edit-1', name: 'edit' }), 1000)
    registry.observeSession(SESSION, event('tool/result', {
      message: { toolCallId: 'edit-1' },
      meta: { diffs: [{ path: 'src/app.ts', oldText: 'old\nline\n', newText: 'new\nline\nextra\n' }] },
    }), 1100)
    const pill = registry.list()[0]
    expect(pill?.changes[0]).toMatchObject({ path: 'src/app.ts', added: 2, removed: 1 })
    expect(pill?.stats.filesChanged).toBe(1)
    expect(pill?.stats.linesAdded).toBe(2)
    expect(pill?.stats.linesRemoved).toBe(1)
    expect(pill?.ticker.at(-1)).toMatchObject({ kind: 'diff', text: 'src/app.ts +2 −1' })
  })

  it('ignores malformed diff metadata without breaking the tool result', () => {
    const { registry } = makeRegistry()
    registry.observeSession(SESSION, event('tool/result', {
      message: { toolCallId: 'missing' },
      meta: { diffs: [{ path: 7, oldText: null, newText: 'x' }] },
    }), 1000)
    expect(registry.list()[0]?.changes).toEqual([])
  })
})

describe('approval tracking', () => {
  it('records the ask, then the decision', () => {
    const { registry } = makeRegistry()
    registry.observeSession(SESSION, event('turn/start', { turn: 1 }), 1000)
    const approval = registry.approvalAsked(
      SESSION,
      { toolName: 'bash', reason: 'runs tests', agent: { id: SESSION.id } },
      2000,
    )
    expect(registry.approvals()).toHaveLength(1)
    expect(approval.id.length).toBeGreaterThan(0)
    expect(registry.list()[0]?.state).toBe('attention')
    registry.approvalDecided(approval.id, SESSION.id, 'allowed-once', 3000)
    expect(registry.approvals()).toHaveLength(0)
    expect(registry.list()[0]?.state).toBe('working')
  })

  it('removes pending approvals when a session is disposed', () => {
    const { registry } = makeRegistry()
    registry.approvalAsked(SESSION, { toolName: 'bash' }, 1000)
    registry.sessionDisposed(SESSION)
    expect(registry.approvals()).toHaveLength(0)
  })

  it('counts each approval ask once', () => {
    const { registry } = makeRegistry()
    registry.approvalAsked(SESSION, { toolName: 'bash' }, 1000)
    expect(registry.snapshot(1000).totals.approvalsAsked).toBe(1)
  })

  it('derives the decision id from the tool call id when present', () => {
    const { registry } = makeRegistry()
    const approval = registry.approvalAsked(
      SESSION,
      { toolName: 'bash', callId: 'call-1', agent: { id: SESSION.id } },
      1000,
    )
    expect(approval.id).toBe(`${SESSION.id}:call-1`)
    expect(approval.callId).toBe('call-1')
  })

  it('counts auto-allowed approvals in totals', () => {
    const { registry } = makeRegistry()
    registry.approvalAutoAllowed()
    expect(registry.snapshot(4000).totals.approvalsAutoAllowed).toBe(1)
  })
})

describe('ticker bounds and snapshot', () => {
  it('keeps at most tickerSize entries', () => {
    const { registry } = makeRegistry()
    for (let i = 0; i < 10; i++) {
      registry.observeSession(SESSION, event('tool/call', { callId: `c${i}`, name: 'read' }), 1000 + i)
    }
    expect(registry.list()[0]?.ticker).toHaveLength(3)
  })

  it('snapshot deep-copies pill state', () => {
    const { registry } = makeRegistry()
    registry.observeSession(
      SESSION,
      event('tool/call', { callId: 'c1', name: 'read', arguments: '{}' }),
      1000,
    )
    expect(registry.list()[0]?.ticker).toHaveLength(1)
    const snap = registry.snapshot(1000)
    snap.sessions[0]!.ticker.push({ t: 1, kind: 'tool', text: 'ghost' })
    expect(registry.list()[0]?.ticker).toHaveLength(1)
    expect(snap.totals.turns).toBe(0)
  })
})

describe('display helpers', () => {
  it('extracts the first text block', () => {
    expect(firstText([{ type: 'text', text: '  hello  ' }])).toBe('hello')
    expect(firstText([{ type: 'image' }])).toBeUndefined()
  })

  it('flattens one line with an ellipsis', () => {
    expect(oneLine('a\n b\tc')).toBe('a b c')
    expect(oneLine('x'.repeat(100), 10).endsWith('…')).toBe(true)
  })

  it('describes tool calls by salient argument', () => {
    expect(describeToolCall('bash', JSON.stringify({ command: 'ls -la' }))).toBe('bash ls -la')
    expect(describeToolCall('read', 'not json')).toBe('read')
    expect(describeToolCall('greet', JSON.stringify({ name: 'Ada' }))).toBe('greet')
  })

  it('describes questions from the payload', () => {
    expect(describeQuestion(JSON.stringify({ questions: [{ question: 'Pick one?' }] }))).toBe('Pick one?')
    expect(describeQuestion(undefined)).toBe('question')
  })

  it('splits basenames across separators', () => {
    expect(basename('/a/b/c')).toBe('c')
    expect(basename('C:\\a\\b')).toBe('b')
    expect(basename('')).toBe('')
  })

  it('formats local date keys', () => {
    expect(dateKey(new Date(2026, 9, 22, 9, 30).getTime())).toBe('2026-10-22')
  })
})

describe('parallel activity and bounded changes', () => {
  it('continues showing an earlier tool after the latest parallel call settles', () => {
    const { registry } = makeRegistry()
    registry.observeSession(SESSION, event('tool/call', { callId:'a', name:'read' }), 1000)
    registry.observeSession(SESSION, event('tool/call', { callId:'b', name:'bash' }), 1001)
    registry.observeSession(SESSION, event('tool/result', { message:{toolCallId:'b'} }), 1002)
    expect(registry.list()[0].currentTool).toBe('read')
  })
  it('counts PTC subcalls and exposes their result metadata', () => {
    const { registry } = makeRegistry()
    registry.observeSession(SESSION,event('tool/ptc-dispatch-start',{subCallId:'sub',name:'write',arguments:{path:'file'}}),1000)
    expect(registry.list()[0].currentTool).toBe('write file')
    registry.observeSession(SESSION,event('tool/ptc-dispatch',{subCallId:'sub',name:'write',isError:false,meta:{diffs:[{path:'file',oldText:null,newText:'hello\n'}]}}),1001)
    expect(registry.list()[0].stats.toolCalls).toBe(1)
    expect(registry.list()[0].changes[0]).toMatchObject({oldText:null,newText:'hello\n'})
  })
  it('counts editing activity cumulatively while retaining the latest file preview', () => {
    const { registry } = makeRegistry()
    for (const [before,after] of [['a','a\nb'],['a\nb','c']]) registry.observeSession(SESSION,event('tool/result',{meta:{diffs:[{path:'file',oldText:before,newText:after}]}}),1000)
    expect(registry.list()[0].stats).toMatchObject({linesAdded:2,linesRemoved:2,filesChanged:1})
    expect(registry.list()[0].changes[0]).toMatchObject({oldText:'a\nb',newText:'c'})
  })
  it('marks oversized previews and estimates without retaining source text', () => {
    const { registry } = makeRegistry()
    registry.observeSession(SESSION,event('tool/result',{meta:{diffs:[{path:'file',oldText:'a\n'.repeat(2100),newText:'b\n'.repeat(2100)}]}}),1000)
    expect(registry.list()[0].changes[0]).toMatchObject({approximate:true})
  })
})
