/** dsh companion. Native dsh and JingleNotch surfaces race through one answer gate. */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { RecapStore } from './recap.ts'
import type { ChildProcess } from 'node:child_process'
import { Service, type Context } from '@deepseek-ai/cordis'
import { isAutoAllowed } from './auto-allow.ts'
import { CompanionRegistry } from './companion.ts'
import { JingleNotchConfigSchema, type JingleNotchConfig } from './config.ts'
import type {} from './events.ts'
import { createNotifier, type Notifier } from './notify.ts'
import { stopOverlay as terminateOverlay, launchOverlay, type OverlayLaunchResult } from './overlay.ts'
import { OverlayApprovals } from './overlay-approvals.ts'
import { QuestionAnswers, validQuestionAnswer, type QuestionAnswer } from './question-answers.ts'
import { createSoundPlayer, type SoundKind, type SoundPlayer } from './sound.ts'
import type {
  ApprovalOutcomeLike,
  ApprovalRequestLike,
  JingleNotchSnapshot,
  QuestionAnswerLike,
  UserQuestionRequestLike,
  SessionEventLike,
  SessionLike,
} from './types.ts'


/**
 * The companion service, available to other plugins as `ctx.jingleNotch`.
 * Registering rows declare `inject: [jingleNotch]` and read {@link snapshot}.
 */
export class JingleNotchService extends Service {
  static Config: typeof JingleNotchConfigSchema = JingleNotchConfigSchema

  private readonly recap?: RecapStore
  private readonly registry: CompanionRegistry
  private readonly notifier: Notifier
  private readonly sound: SoundPlayer
  private readonly config: JingleNotchConfig
  private readonly autoAllowTools: readonly string[]
  /** Tool names granted through accepted surface clicks, grouped by session. */
  private readonly sessionAlways = new Map<string, Set<string>>()
  private readonly overlayApprovals = new OverlayApprovals()
  private readonly questionAnswers = new QuestionAnswers()
  private readonly continuedQuestionAgents = new Map<string, unknown>()
  private questionSurfaceReady = false
  private surfaceSeenAt = 0
  private overlayChild: ChildProcess | undefined

  constructor(ctx: Context, config: JingleNotchConfig) {
    super(ctx, 'jingleNotch')
    // Schemastery fills schema defaults before the constructor runs; the cast
    // records that the optional fields (`sounds.file`) arrive resolved.
    this.config = config as JingleNotchConfig
    if (this.config.recap?.enabled !== false) this.recap = new RecapStore(this.config.recap?.directory || join(homedir(), '.local', 'share', 'dsh-jingle-notch'), m => ctx.logger.warn(m))
    this.autoAllowTools = this.config.autoAllowTools
    this.registry = new CompanionRegistry(
      { tickerSize: this.config.tickerSize, finishedHoldMs: this.config.finishedHoldMs },
    )
    this.notifier = createNotifier((message: string) => ctx.logger.warn(message))
    this.sound = createSoundPlayer({ file: this.config.sounds.file }, (message: string) => ctx.logger.warn(message))

    ctx.on('agent/inbox/discarded', ({agent, message}) => {
      if (message.source.kind === 'user-question-reply' && message.source.callId) this.registry.questionQueued(agent.session.id, message.source.callId, false)
    }, { global:true })
    ctx.on('session/event', (session: SessionLike, event: SessionEventLike) => {
      this.observe(session, event)
    })
    ctx.on('session/disposed', (session: SessionLike) => {
      for (const approval of this.registry.approvals()) {
        if (approval.sessionId === session.id) this.overlayApprovals.cancel(approval.id)
      }
      for (const key of this.continuedQuestionAgents.keys()) {
        if (key.startsWith(`${session.id}:`)) {
          this.questionAnswers.cancel(key)
          this.continuedQuestionAgents.delete(key)
        }
      }
      this.recap?.forget(session.id)
      this.sessionAlways.delete(session.id)
      this.registry.sessionDisposed(session)
    })
    ctx.on('approval/request', async (req: ApprovalRequestLike, next: () => Promise<ApprovalOutcomeLike>) => {
      return this.onApprovalRequest(req, next)
    }, { prepend:true })
    ctx.on('user-questions/request', async (req: UserQuestionRequestLike, next: () => Promise<QuestionAnswerLike>) => {
      return this.onQuestionRequest(req, next)
    }, { prepend:true })

    const surfaceTimer = setInterval(() => {
      if (!this.hasActiveSurface()) {
        this.overlayApprovals.cancelAll()
        this.questionAnswers.cancelAll()
      }
    }, 1000)
    surfaceTimer.unref()

    // The registry arms hold timers; disposal drops the pills, pending
    // entries, and the overlay child.
    ctx.effect(() => async () => {
      clearInterval(surfaceTimer)
      this.registry.dispose()
      this.overlayApprovals.dispose()
      this.questionAnswers.dispose()
      this.continuedQuestionAgents.clear()
      this.questionSurfaceReady = false
      if (this.overlayChild) terminateOverlay(this.overlayChild, m => ctx.logger.warn(m))
      await this.recap?.close()
    })
  }

  /** Serializable companion state for dashboards, overlays, and commands. */
  snapshot(now: number = Date.now()): JingleNotchSnapshot {
    return { ...this.registry.snapshot(now), ...(this.recap ? {recap:this.recap.snapshot()} : {}) }
  }

  /** Resolved engine configuration, for surface rows reading overlay options. */
  get configuration(): JingleNotchConfig {
    return this.config
  }

  /**
   * Submit one surface decision (notch overlay button, dashboard card) for a
   * pending approval. `'always'` grants this request and subsequent requests in this
   * session for the tool — jingleNotch's per-run "Always"; persistence
   * stays with the `autoAllowTools` config.
   * @returns whether a pending approval carried this id.
   */
  answerApproval(id: string, decision: 'allowed-once' | 'rejected' | 'always'): boolean {
    const approval = this.registry.approvals().find(item => item.id === id)
    if (approval === undefined || !this.overlayApprovals.answer(id, decision)) return false
    if (decision === 'always' && approval.sessionId !== undefined) {
      const tools = this.sessionAlways.get(approval.sessionId) ?? new Set<string>()
      tools.add(approval.toolName)
      this.sessionAlways.set(approval.sessionId, tools)
    }
    return true
  }

  /** Answer a question currently waiting on the surface waterfall. */
  answerQuestion(sessionId: string, callId: string, answer: QuestionAnswer): boolean {
    const key = `${sessionId}:${callId}`
    const pending = this.registry.questions().find(item => item.sessionId === sessionId && item.callId === callId)
    if (!pending?.answerable || pending.questions === undefined || !validQuestionAnswer(answer, pending.questions)) return false
    if (this.questionAnswers.answer(key, answer)) return true
    const agent = this.continuedQuestionAgents.get(key)
    const userQuestions = this.ctx.get('userQuestions')
    if (agent === undefined || userQuestions === undefined) return false
    try {
      const accepted = userQuestions.answer(agent, callId, answer)
      if (accepted) {
        this.registry.questionQueued(sessionId, callId, true)
      }
      return accepted
    } catch (error: unknown) {
      this.ctx.logger.warn(`jingle-notch: continued question answer failed for ${callId}: ${String(error)}`)
      return false
    }
  }

  /** Surface rows call this while a dashboard capable of answering is mounted. */
  enableQuestionSurface(): void {
    this.questionSurfaceReady = true
  }

  surfaceSeen(): void { this.surfaceSeenAt = Date.now() }

  private hasActiveSurface(): boolean {
    return (this.questionSurfaceReady || this.overlayChild !== undefined) && Date.now() - this.surfaceSeenAt < 6000
  }

  disableQuestionSurface(): void {
    this.questionSurfaceReady = false
    if (this.overlayChild === undefined) {
      this.questionAnswers.cancelAll()
      this.overlayApprovals.cancelAll()
    }
  }

  /**
   * Spawn the notch overlay against `stateOrigin` unless it already runs.
   * The service owns the child and kills it on disposal.
   */
  startOverlay(stateOrigin: string): OverlayLaunchResult {
    const previous = this.overlayChild
    const { child, result } = launchOverlay(
      {
        electronPath: this.config.overlay.electronPath,
        stateOrigin,
        yOffset: this.config.overlay.yOffset,
        log: (m) => this.ctx.logger.warn(m),
      },
      this.overlayChild,
    )
    this.overlayChild = child
    if (child !== undefined && child !== previous) {
      child.once('exit', () => {
        if (this.overlayChild !== child) return
        this.overlayChild = undefined
        if (!this.questionSurfaceReady) {
          this.overlayApprovals.cancelAll()
          this.questionAnswers.cancelAll()
        }
      })
    }
    return result
  }

  /** Stop only the optional native surface; the companion and dashboard remain available. */
  stopOverlay(): OverlayLaunchResult {
    const child = this.overlayChild
    if (child === undefined || child.exitCode !== null || child.killed) return {ok:true, message:'overlay: not running'}
    terminateOverlay(child, message => this.ctx.logger.warn(message))
    return {ok:true, message:'overlay: stopping'}
  }

  /** Feed one durable session event through the pill engine, then react. */
  private observe(session: SessionLike, event: SessionEventLike): void {
    let questionAsked = false
    try {
      const before = this.registry.questions().length
      this.registry.observeSession(session, event, Date.now())
      const type = event.type
      const data = event.data as {message?:{isError?:boolean}; isError?:boolean; source?:{kind?:string;callId?:string}}
      if (type === 'user/message' && data.source?.kind === 'user-question-reply' && data.source.callId) this.continuedQuestionAgents.delete(`${session.id}:${data.source.callId}`)
      this.recap?.record(session.id, {
        turns:type === 'turn/start' ? 1 : 0,
        toolCalls:type === 'tool/call' || type === 'tool/ptc-dispatch-start' ? 1 : 0,
        errors:data.message?.isError || data.isError ? 1 : 0,
        questions:Math.max(0, this.registry.questions().length - before),
      }, Date.now(), ['thinking','working','attention'].includes(this.registry.list().find(p=>p.id===session.id)?.state ?? ''))
      questionAsked = this.registry.questions().length > before && event.type === 'tool/call'
    } catch (error: unknown) {
      this.ctx.logger.warn(`jingle-notch: session event handling failed: ${String(error)}`)
      return
    }
    if (questionAsked && this.config.notifications.enabled && this.config.notifications.onQuestion) {
      const pending = this.registry.questions().at(-1)
      this.notifier.send('JingleNotch — question', pending === undefined ? 'The agent asks a question.' : pending.preview)
    }
    if (questionAsked && this.config.sounds.enabled && this.config.sounds.onQuestion) {
      this.sound.play('question')
    }
    if (event.type === 'turn/end') {
      this.onTurnEnd(session, event.data)
    }
  }

  /**
   * Approval gate: notify, mirror, auto-allow configured tools, then give both
   * the native dsh answerer and JingleNotch surfaces the same request. The first
   * completed answer wins; a late surface answer is discarded by the channel.
   */
  private async onApprovalRequest(
    req: ApprovalRequestLike,
    next: () => Promise<ApprovalOutcomeLike>,
  ): Promise<ApprovalOutcomeLike> {
    const now = Date.now()
    const sessionId = sessionIdOf(req)
    const session: SessionLike | undefined = sessionId === undefined ? undefined : { id: sessionId }
    const approval = this.registry.approvalAsked(session, req, now)
    this.recap?.record(sessionId ?? 'unrouted', {approvals:1}, now)
    if (this.config.notifications.enabled && this.config.notifications.onApproval) {
      this.notifier.send(
        'JingleNotch — approval',
        req.reason === undefined ? `The agent asks to run ${req.toolName}.` : `${req.toolName}: ${req.reason}`,
      )
    }
    if (this.config.sounds.enabled && this.config.sounds.onApproval) this.sound.play('approval')
    if (isAutoAllowed([...this.autoAllowTools, ...(this.sessionAlways.get(sessionId ?? '') ?? [])], req)) {
      this.registry.approvalAutoAllowed()
      this.registry.approvalDecided(approval.id, sessionId, 'allowed-once', Date.now())
      this.ctx.logger.info(`jingle-notch: auto-allowed ${req.toolName} (autoAllowTools)`)
      return 'allowed-once'
    }
    let outcome: ApprovalOutcomeLike = 'cancelled'
    try {
      if (!this.hasActiveSurface()) {
        approval.answerable = false
        outcome = await next()
      } else {
        approval.answerable = true
        const surface = this.overlayApprovals.wait(approval.id, req.signal)
        // Defer the native listener by one microtask so an already-aborted
        // request never opens a second UI claim.
        const downstream = Promise.resolve().then(() => {
          if (req.signal?.aborted) return 'cancelled' as ApprovalOutcomeLike
          return next()
        })
        const decision = await Promise.race([downstream, surface])
        approval.answerable = false
        // A surface can disappear while the native dsh card is still open.
        // Keep waiting for the already-started native listener; invoking
        // next() a second time would duplicate the request.
        if (decision === 'cancelled' && !req.signal?.aborted && this.registry.approvals().some(item => item.id === approval.id)) outcome = await downstream
        else outcome = decision
      }
      return outcome
    } finally {
      this.overlayApprovals.cancel(approval.id)
      this.registry.approvalDecided(approval.id, sessionId, outcome, Date.now())
    }
  }

  /** Route structured questions to both surfaces through one first-answer gate. */
  private async onQuestionRequest(
    req: UserQuestionRequestLike,
    next: () => Promise<QuestionAnswerLike>,
  ): Promise<QuestionAnswerLike> {
    const sessionId = req.agent?.session?.id ?? req.agent?.id
    const callId = req.wait?.callId
      ?? req.questions.find(item => item.intent?.callId)?.intent?.callId
      ?? this.registry.latestQuestionCallId(sessionId)
    if (!sessionId || !callId) return next()
    if (req.signal?.aborted) throw questionError(req.signal)
    const previouslyPending = this.registry.questions().some(item => item.sessionId === sessionId && item.callId === callId)
    this.registry.questionRequested(sessionId, callId, req.questions)
    if (!previouslyPending) {
      this.recap?.record(sessionId, {questions:1}, Date.now())
      if (this.config.notifications.enabled && this.config.notifications.onQuestion) this.notifier.send('JingleNotch — question', req.questions[0]?.question ?? 'The agent asks a question.')
      if (this.config.sounds.enabled && this.config.sounds.onQuestion) this.sound.play('question')
    }
    const key = `${sessionId}:${callId}`
    if (req.agent !== undefined) this.continuedQuestionAgents.set(key, req.agent)
    let continued = false
    try {
      if (!this.hasActiveSurface()) {
        this.registry.questionAnswerable(sessionId, callId, false)
        return await next()
      }
      this.registry.questionAnswerable(sessionId, callId, true)
      const surface = this.questionAnswers.wait(key, req.signal)
      // Defer the native listener by one microtask so an already-aborted
      // request does not create a native card after the surface withdrew it.
      const downstream = Promise.resolve().then(() => {
        if (req.signal?.aborted) return Promise.reject(questionError(req.signal))
        return next()
      })
      const winner = await Promise.race([
        downstream.then(answer => ({ source: 'native' as const, answer })),
        surface.then(answer => ({ source: 'jingleNotch' as const, answer })),
      ])
      if (winner.source === 'native') return winner.answer
      if (winner.answer !== undefined) return winner.answer
      if (req.signal?.aborted) throw questionError(req.signal)
      if (!this.registry.questions().some(item => item.sessionId === sessionId && item.callId === callId)) throw questionError(req.signal)
      // JingleNotch was withdrawn (for example when its dashboard was unloaded),
      // so let the native listener that is already running finish the request.
      return await downstream
    } catch (error) {
      continued = req.wait?.timed === true
        && (errorCode(error) === 'ASK_TIMED_OUT' || errorCode(req.signal?.reason) === 'ASK_TIMED_OUT')
      if (continued) this.registry.questionAnswerable(sessionId, callId, true)
      throw error
    } finally {
      this.questionAnswers.cancel(key)
      if (!continued) {
        this.continuedQuestionAgents.delete(key)
        this.registry.questionSettled(sessionId, callId, Date.now())
      }
    }
  }

  /** Turn boundary reactions: finish chime plus the optional end-of-turn notice. */
  private onTurnEnd(session: SessionLike, data: unknown): void {
    const kind = (data as { reason?: { kind?: string } }).reason?.kind
    if (kind === 'completed') {
      if (this.config.sounds.enabled && this.config.sounds.onFinish) this.sound.play('finish')
      if (this.config.notifications.enabled && this.config.notifications.onTurnEnd) {
        this.notifier.send('JingleNotch — finished', `Turn completed in ${labelOf(this.registry, session.id)}.`)
      }
      return
    }
    if (kind === 'error' && this.config.notifications.enabled && this.config.notifications.onTurnEnd) {
      this.notifier.send('JingleNotch — failed', `Turn failed in ${labelOf(this.registry, session.id)}.`)
    }
  }
}

/** The agent id IS the session id, so approval requests route back to their pill. */
function sessionIdOf(req: ApprovalRequestLike): string | undefined {
  const id = req.agent?.id
  return typeof id === 'string' && id.length > 0 ? id : undefined
}

function labelOf(registry: CompanionRegistry, sessionId: string): string {
  return registry.list().find((pill) => pill.id === sessionId)?.label ?? 'session'
}

function errorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined
}

function questionError(signal?: AbortSignal): Error {
  if (errorCode(signal?.reason) === 'ASK_TIMED_OUT') return signal!.reason as Error
  return Object.assign(new Error('jingle-notch: question wait was withdrawn'), { name: 'UserQuestionError', code: 'ASK_ABORTED' })
}

/** Sound kinds the service plays; exported for tests and surface rows. */
export type { SoundKind }

export default JingleNotchService
