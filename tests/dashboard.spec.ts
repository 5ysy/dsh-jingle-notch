import { createServer, request } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Context } from '@deepseek-ai/cordis'
import { afterEach, expect, it, vi } from 'vitest'
import { apply } from '../src/dashboard.ts'
import type { ConnectionLike, WebRouteLike } from '../src/host-views.ts'

const cleanup: Array<() => Promise<void>> = []
afterEach(async () => { for (const close of cleanup.splice(0)) await close() })
async function setup() {
  const routes: WebRouteLike[] = []
  const admit = vi.fn<ConnectionLike['admit']>(() => ({ rejection: 401 }))
  const jingleNotch = {
    enableQuestionSurface: vi.fn(), disableQuestionSurface: vi.fn(),
    surfaceSeen: vi.fn(), snapshot: () => ({ sessions: [] }), configuration: { overlay: { enabled: true, autoStart: false } },
    answerApproval: vi.fn(() => true), answerQuestion: vi.fn(() => true), startOverlay: vi.fn(() => ({ ok: true })),
  }
  const server = createServer((req, res) => {
    const path = new URL(req.url!, 'http://localhost').pathname
    const route = routes.find(r => r.kind === 'exact' ? path === r.path : path === r.path || path.startsWith(`${r.path}/`))
    if (route) void route.handler(req, res)
    else { res.writeHead(404); res.end() }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const effects: Array<() => void> = []
  apply({ jingleNotch, connection: { admit }, webServer: { register: (r: WebRouteLike) => { routes.push(r); return () => {} }, getOrigin: () => origin },
    effect: (fn: () => () => void) => effects.push(fn()), logger: { info: vi.fn(), warn: vi.fn() },
  } as unknown as Context)
  cleanup.push(async () => { effects.forEach(fn => fn()); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) })
  function send(path: string, headers: Record<string, string> = {}, body?: unknown, method = body === undefined ? 'GET' : 'POST') {
    return new Promise<number>((resolve, reject) => {
      const req = request(`${origin}${path}`, { method, headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode!)) })
      req.on('error', reject)
      req.end(body === undefined ? undefined : JSON.stringify(body))
    })
  }
  return { send, jingleNotch, admit, origin }
}
it('routes normal approval and question paths using the real host prefix contract', async () => {
  const { send, jingleNotch } = await setup()
  expect(await send('/jingle/api/state')).toBe(200)
  expect(await send('/jingle')).toBe(200)
  expect(await send('/jingle/api/approvals/a', {}, { decision: 'allowed-once' })).toBe(200)
  expect(await send('/jingle/api/questions/s/c', {}, { answers: [] })).toBe(200)
  expect(jingleNotch.answerApproval).toHaveBeenCalledWith('a', 'allowed-once')
  expect(jingleNotch.answerQuestion).toHaveBeenCalledWith('s', 'c', { answers: [] })
})
it('rejects hostile Host, cross-origin Origin and Fetch Metadata on loopback', async () => {
  const { send, jingleNotch } = await setup()
  expect(await send('/jingle/api/state', { host: 'evil.example' })).toBe(401)
  expect(await send('/jingle/api/state', { origin: 'https://evil.example' })).toBe(403)
  expect(await send('/jingle/api/overlay', { 'sec-fetch-site': 'cross-site' }, {})).toBe(403)
  expect(jingleNotch.startOverlay).not.toHaveBeenCalled()
})
it('requires JSON for mutations and rejects malformed paths and methods', async () => {
  const { send, origin } = await setup()
  expect(await send('/jingle/api/approvals/a', { origin, 'content-type': 'text/plain' }, { decision: 'always' })).toBe(415)
  expect(await send('/jingle/api/approvals/a')).toBe(405)
  expect(await send('/jingle/api/questions/%zz/c', {}, {})).toBe(400)
})

it('defers declared proxy authorities to authenticated host admission',async()=>{
 const {send,admit}=await setup()
 admit.mockReturnValue({peer:{id:'authenticated'}})
 expect(await send('/jingle/api/state',{host:'harness.example',origin:'https://harness.example'})).toBe(200)
 expect(admit).toHaveBeenCalledTimes(1)
})
