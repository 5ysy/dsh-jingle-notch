/**
 * jingleNotch dashboard surface: mirrors the companion service over the web GUI's
 * HTTP server. `/jingle` serves the self-contained dashboard page,
 * `/jingle/api/state` the JSON snapshot, `POST /jingle/api/approvals/:id`
 * answers a pending approval from a surface UI, and `POST /jingle/api/overlay`
 * spawns the notch overlay. Non-loopback requests use dsh's signed connection
 * admission before any state or approval data is served.
 */
import { randomBytes } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type {} from './events.ts'
import type {} from './host-views.ts'
import { dashboardPage } from './page.ts'

export const name = 'jingle-notch-dashboard'
export const inject = ['jingleNotch', 'webServer', 'connection']

/** Decisions a surface UI may submit on the approvals endpoint. */
const DECISIONS = new Set(['allowed-once', 'rejected', 'always'])

export function apply(ctx: Context): void {
  const jingleNotch = ctx.jingleNotch
  const webServer = ctx.webServer
  const connection = ctx.connection
  const nonce = randomBytes(18).toString('base64')
  const page = dashboardPage().replace('<script>', `<script nonce="${nonce}">`)
  jingleNotch.enableQuestionSurface()
  ctx.effect(() => () => jingleNotch.disableQuestionSurface())

  const json = (res: import('node:http').ServerResponse, status: number, body: unknown): void => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify(body))
  }

  ctx.effect(() =>
    webServer.register({
      kind: 'exact',
      path: '/jingle',
      handler: (req, res) => {
        if (!authorizeSurface(req, res, connection, webServer.getOrigin())) return
        if (req.method !== 'GET') {
          json(res, 405, { error: 'GET required' })
          return
        }
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options':'nosniff',
          'content-security-policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'` })
        res.end(page)
      },
    }),
  )

  ctx.effect(() =>
    webServer.register({
      kind: 'prefix',
      path: '/jingle/api/questions',
      handler: (req, res) => {
        if (!authorizeSurface(req, res, connection, webServer.getOrigin())) return
        if (req.method !== 'POST') {
          json(res, 405, { error: 'POST a structured answer batch' })
          return
        }
        if (!requireJson(req, res)) return
        const suffix = req.url?.split('?', 1)[0]?.slice('/jingle/api/questions/'.length) ?? ''
        const separator = suffix.indexOf('/')
        if (separator <= 0 || separator === suffix.length - 1) {
          json(res, 400, { error: 'session id and call id are required' })
          return
        }
        let sessionId: string
        let callId: string
        try {
          sessionId = decodeURIComponent(suffix.slice(0, separator))
          callId = decodeURIComponent(suffix.slice(separator + 1))
        } catch {
          json(res, 400, { error: 'question id is not valid URL encoding' })
          return
        }
        void readBody(req, (message) => ctx.logger.warn(`jingleNotch dashboard: ${message}`)).then((body) => {
          if (!isQuestionAnswer(body)) {
            json(res, 400, { error: 'body must contain an answers array' })
            return
          }
          const answered = jingleNotch.answerQuestion(sessionId, callId, body)
          json(res, answered ? 200 : 404, answered ? { ok: true } : { error: 'Answer rejected: check all question IDs and options, or refresh if another surface answered.' })
        })
      },
    }),
  )

  ctx.effect(() =>
    webServer.register({
      kind: 'exact',
      path: '/jingle/api/state',
      handler: (req, res) => {
        if (!authorizeSurface(req, res, connection, webServer.getOrigin())) return
        if (req.method !== 'GET') {
          json(res, 405, { error: 'GET required' })
          return
        }
        jingleNotch.surfaceSeen()
        json(res, 200, jingleNotch.snapshot())
      },
    }),
  )

  ctx.effect(() =>
    webServer.register({
      kind: 'prefix',
      path: '/jingle/api/approvals',
      handler: (req, res) => {
        if (!authorizeSurface(req, res, connection, webServer.getOrigin())) return
        if (req.method !== 'POST') {
          json(res, 405, { error: 'POST a {"decision"} of allowed-once, rejected, or always' })
          return
        }
        if (!requireJson(req, res)) return
        let id: string
        try {
          id = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname.slice('/jingle/api/approvals/'.length))
        } catch {
          json(res, 400, { error: 'approval id is not valid URL encoding' })
          return
        }
        if (id.length === 0) {
          json(res, 400, { error: 'approval id is required' })
          return
        }
        void readBody(req, (message) => ctx.logger.warn(`jingleNotch dashboard: ${message}`)).then((body) => {
          const decision = isRecord(body) ? body.decision : undefined
          if (typeof decision !== 'string' || !DECISIONS.has(decision)) {
            json(res, 400, { error: 'decision must be allowed-once, rejected, or always' })
            return
          }
          const answered = jingleNotch.answerApproval(id, decision as 'allowed-once' | 'rejected' | 'always')
          json(res, answered ? 200 : 404, answered ? { ok: true } : { error: 'no pending approval with this id' })
        })
      },
    }),
  )

  ctx.effect(() =>
    webServer.register({
      kind: 'exact',
      path: '/jingle/api/overlay',
      handler: (req, res) => {
        if (!authorizeSurface(req, res, connection, webServer.getOrigin())) return
        if (req.method !== 'POST') {
          json(res, 405, { error: 'POST to launch the notch overlay' })
          return
        }
        if (!requireJson(req, res)) return
        if (!jingleNotch.configuration.overlay.enabled) {
          json(res, 409, { ok: false, message: 'overlay: disabled by config (overlay.enabled)' })
          return
        }
        json(res, 200, jingleNotch.startOverlay(webServer.getOrigin()))
      },
    }),
  )

  ctx.logger.info('jingle-notch: dashboard at /jingle')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isQuestionAnswer(value: unknown): value is { answers: Array<{ id: string; selected: string[]; custom?: string }> } {
  if (!isRecord(value) || !Array.isArray(value.answers)) return false
  return value.answers.every((item) => {
    if (!isRecord(item) || typeof item.id !== 'string' || !Array.isArray(item.selected)) return false
    return item.selected.every((label) => typeof label === 'string')
      && (item.custom === undefined || typeof item.custom === 'string')
  })
}

function authorizeSurface(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  connection: import('./host-views.ts').ConnectionLike,
  origin: string,
): boolean {
  const local = isLoopbackAddress(req.socket.remoteAddress)
  if (!local) return admit()
  const bound = new URL(origin)
  const host = req.headers.host
  // Loopback clients must still satisfy browser origin and DNS-rebinding fences.
  let authority: URL | undefined
  try { authority = new URL(`${bound.protocol}//${host ?? ''}`) } catch { /* Rejected below. */ }
  const localHost = authority !== undefined && ['localhost', '127.0.0.1', '[::1]'].includes(authority.hostname)
    && authority.port === bound.port
  const trustedHost = authority?.host === bound.host || (local && localHost)
  const sameOrigin = req.headers.origin === undefined || req.headers.origin === `${bound.protocol}//${host}`
  if (!trustedHost) return admit()
  if (!sameOrigin || req.headers['sec-fetch-site'] === 'cross-site') {
    res.writeHead(403, { 'cache-control': 'no-store' })
    res.end('forbidden')
    return false
  }
  return true
  function admit(): boolean {
    const admission = connection.admit(req)
    if ('rejection' in admission) {
      res.writeHead(admission.rejection, { 'cache-control': 'no-store' })
      res.end(admission.rejection === 401 ? 'unauthorized' : 'forbidden')
      return false
    }
    return true
  }
}

function isLoopbackAddress(address: string | undefined): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

/** Read and parse one JSON request body; unparseable bodies yield `{}`. */
function readBody(req: import('node:http').IncomingMessage, log: (message: string) => void): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    let length = 0
    let settled = false
    const finish = (body: unknown): void => {
      if (settled) return
      settled = true
      resolve(body)
    }
    req.on('data', (chunk: Buffer) => {
      if (settled) return
      length += chunk.byteLength
      if (length > 64 * 1024) {
        log('request body exceeded 64 KiB')
        finish({})
        req.resume()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) return
      const text = Buffer.concat(chunks).toString('utf8')
      if (text.length === 0) {
        finish({})
        return
      }
      try {
        finish(JSON.parse(text) as unknown)
      } catch {
        log('invalid JSON request body')
        finish({})
      }
    })
    req.on('error', (error: unknown) => {
      log(`request body read failed: ${String(error)}`)
      finish({})
    })
  })
}

function requireJson(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse): boolean {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() === 'application/json') return true
  res.writeHead(415, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  res.end(JSON.stringify({ error: 'application/json required' }))
  return false
}
