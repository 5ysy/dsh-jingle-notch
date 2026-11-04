// Test-only routes and answerers. This file is excluded from the published package.
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

export const inject = ['jingleNotch', 'commands', 'sessions', 'webServer', 'agents', 'approval', 'userQuestions']

export async function apply(ctx) {
  const require = createRequire(join(process.env.JINGLE_NOTCH_TEST_MODULES, '@deepseek-ai/dsh/package.json'))
  const { createToolResultMessage } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-llm')).href)
  let handle
  let pending
  const outcomes = {}
  const abort = new AbortController()
  ctx.effect(() => () => abort.abort())
  // Hold the native side open without a connected browser; production routing still executes.
  for (const event of ['approval/request', 'user-questions/request']) {
    ctx.on(event, (request, next) => {
      if (request.agent !== handle?.agent) return next()
      return new Promise((resolve, reject) => {
        const finish = () => event === 'approval/request'
          ? resolve('cancelled')
          : reject(Object.assign(new Error('Fixture stopped'), { code: 'ASK_ABORTED' }))
        if (abort.signal.aborted) finish()
        else abort.signal.addEventListener('abort', finish, { once: true })
      })
    })
  }
  function track(name, task) {
    pending = task.then(value => { outcomes[name] = value }, error => {
      outcomes[name] = { error: String(error), code: error?.code }
    })
  }
  async function route(action) {
    if (action === 'setup') {
      assert.equal(handle, undefined, 'Fixture can run only once per isolated host')
      handle = await ctx.agents.create({ sessionId: 'jingle-notch-host-compat', meta: { cwd: process.cwd() } })
      const { agent } = handle
      const { session } = agent
      session.append('turn/start', { turn: 1 })
      session.append('tool/call', { turn: 1, step: 1, callId: 'compat-patch', name: 'apply_patch', arguments: '{}' })
      let pill = ctx.jingleNotch.snapshot().sessions.find(item => item.id === session.id)
      assert.equal(pill?.state, 'working')
      assert.equal(pill.activeToolCount, 1)
      session.append('tool/result', {
        turn: 1, step: 1,
        message: createToolResultMessage({
          callId: 'compat-patch', content: [{ type: 'text', text: 'Compatibility fixture' }], isError: false,
        }),
        meta: { diffs: [{ path: 'compat.txt', oldText: 'before\n', newText: 'after\n' }], stopped: false },
      }, { surfaceOp: 'append' })
      pill = ctx.jingleNotch.snapshot().sessions.find(item => item.id === session.id)
      assert.equal(pill.activeToolCount, 0)
      assert.equal(pill.stats.filesChanged, 1)
      assert.equal(pill.stats.linesAdded, 1)
      assert.equal(pill.stats.linesRemoved, 1)
      const execution = await ctx.commands.execute(agent, '/jingle', [], abort.signal)
      assert.equal(execution?.result.kind, 'success')
      return { ok: true, bundles: ctx.get('profileContext').startedBundles }
    }
    assert.ok(handle, 'Call setup first')
    const { agent } = handle
    if (action === 'approval') {
      ctx.jingleNotch.surfaceSeen()
      track('approval', ctx.approval.request({
        agent, toolName: 'bash', callId: 'compat-approval', reason: 'Compatibility fixture only', signal: abort.signal,
      }))
    } else if (action === 'question') {
      ctx.jingleNotch.surfaceSeen()
      track('question', ctx.userQuestions.ask({
        agent, signal: abort.signal, wait: { callId: 'compat-plan' },
        questions: [
          { id: 'plan', question: 'Review compatibility plan', detail: '# Complete plan\n\nVerify Desktop and Web.\nEND OF PLAN',
            options: [{ label: 'Approve "exact" plan' }, { label: 'Revise' }],
            intent: { kind: 'plan-review', approve: 'Approve "exact" plan', callId: 'compat-plan' } },
          { id: 'checks', question: 'Select checks', multiSelect: true, options: [{ label: 'Types' }, { label: 'Tests' }] },
        ],
      }))
    } else if (action === 'result') {
      return { ok: true, outcomes }
    } else if (action === 'finish') {
      await pending
      assert.equal(outcomes.approval, 'allowed-once')
      assert.deepEqual(outcomes.question, { answers: [
        { id: 'plan', selected: ['Approve "exact" plan'] }, { id: 'checks', selected: ['Types', 'Tests'] },
      ] })
      const audits = agent.session.snapshotEvents().filter(event => event.type === 'approval/decided')
      assert.equal(audits.at(-1)?.data.outcome, 'allowed-once')
      agent.session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
      assert.equal(ctx.jingleNotch.snapshot().sessions.find(item => item.id === agent.id)?.state, 'finished')
      assert.equal(ctx.jingleNotch.snapshot().approvals.length, 0)
      assert.equal(ctx.jingleNotch.snapshot().questions.length, 0)
      return { ok: true, audit: 'allowed-once', outcomes }
    } else {
      throw new Error('Unknown fixture action')
    }
    return { ok: true }
  }
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix', path: '/__jingle-notch-host-test',
    async handler(req, res) {
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) {
        res.writeHead(403); res.end(); return
      }
      try {
        assert.equal(req.method, 'POST')
        const action = new URL(req.url, 'http://localhost').pathname.split('/').at(-1)
        const result = await route(action)
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (error) {
        ctx.logger.warn(`jingleNotch host fixture: ${String(error)}`)
        res.writeHead(500, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: String(error) }))
      }
    },
  }))
}
