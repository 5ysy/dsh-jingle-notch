/**
 * The pill engine: one companion pill per observed session, a bounded activity
 * ticker, and session counters. Pure logic — no process, clock, or I/O calls;
 * time enters through event payloads and the `now` argument so tests drive it
 * deterministically.
 */
import type {
  ApprovalOutcomeLike,
  ApprovalRequestLike,
  JingleNotchSnapshot,
  ChangeSummary,
  PendingApproval,
  PendingQuestion,
  QuestionItemLike,
  PillState,
  SessionEventLike,
  SessionLike,
  SessionPill,
  TickerEntry,
  TextBlockLike,
  ToolCallDataLike,
  ToolResultDataLike,
  TurnEndDataLike,
} from './types.ts'

/** Companion options the pill engine reads; notification and sound policy stay with the service. */
export interface CompanionOptions {
  /** Entries kept per session ticker; older entries drop off the head. */
  tickerSize: number
  /** Milliseconds a `finished` or `error` pill stays highlighted before idling. */
  finishedHoldMs: number
}

export const COMPANION_DEFAULTS: CompanionOptions = {
  tickerSize: 30,
  finishedHoldMs: 5000,
}

/** States a pill returns to after the finished/error hold elapses. */
const HOLD_STATES: ReadonlySet<PillState> = new Set(['finished', 'error'])

/** Question tool whose open call means the agent waits on a human answer. */
export const QUESTION_TOOL = 'ask_user_question'

/** Basename of a POSIX or Windows path; the empty path yields the empty string. */
export function basename(path: string): string {
  const normalized = path.replaceAll('\\', '/')
  const last = normalized.split('/').filter((segment) => segment.length > 0).at(-1)
  return last ?? ''
}

/** First line of a text block sequence, trimmed; absent text yields undefined. */
export function firstText(blocks: readonly unknown[]): string | undefined {
  for (const block of blocks) {
    const candidate = block as TextBlockLike
    if (candidate.type === 'text' && typeof candidate.text === 'string' && candidate.text.trim().length > 0) {
      return candidate.text.trim()
    }
  }
  return undefined
}

/** Truncate one line of display text to `max` code units with an ellipsis. */
export function oneLine(text: string, max = 80): string {
  const flat = text.replaceAll(/\s+/gu, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

/**
 * Short human label for a tool call: the salient argument for known tools,
 * a truncated first string argument otherwise. Parsing is best-effort — an
 * unparseable argument body degrades to the tool name alone.
 */
export function describeToolCall(name: string, rawArguments: string | undefined): string {
  if (!rawArguments) return name
  let parsed: unknown
  try {
    parsed = JSON.parse(rawArguments)
  } catch {
    return name
  }
  if (typeof parsed !== 'object' || parsed === null) return name
  const args = parsed as Record<string, unknown>
  const salient = ['command', 'file_path', 'path', 'url', 'query', 'pattern', 'skill']
    .map((key) => args[key])
    .find((value): value is string => typeof value === 'string' && value.length > 0)
  return salient === undefined ? name : `${name} ${oneLine(salient, 56)}`
}

/** Short argument preview for a pending question payload. */
export function describeQuestion(rawArguments: string | undefined): string {
  if (!rawArguments) return 'question'
  try {
    const parsed: unknown = JSON.parse(rawArguments)
    if (typeof parsed === 'object' && parsed !== null) {
      const questions = (parsed as { questions?: unknown }).questions
      if (Array.isArray(questions)) {
        const first = questions[0] as { question?: unknown } | undefined
        if (first !== undefined && typeof first.question === 'string') return oneLine(first.question, 96)
      }
    }
  } catch {
    // Fall through to the truncated raw body below.
  }
  return oneLine(rawArguments, 96)
}

/** Parse the safe, displayable subset of a question batch from tool arguments. */
export function parseQuestionItems(rawArguments: string | undefined): QuestionItemLike[] {
  if (!rawArguments) return []
  try {
    const parsed: unknown = JSON.parse(rawArguments)
    if (!isRecord(parsed) || !Array.isArray(parsed.questions)) return []
    return parsed.questions.flatMap((value) => {
      if (!isRecord(value) || typeof value.id !== 'string' || typeof value.question !== 'string') return []
      const options = Array.isArray(value.options)
        ? value.options.flatMap((option) => {
          if (!isRecord(option) || typeof option.label !== 'string') return []
          return [{ label: option.label, description: typeof option.description === 'string' ? option.description : undefined }]
        })
        : undefined
      return [{
        id: value.id,
        question: value.question,
        detail: typeof value.detail === 'string' ? value.detail : undefined,
        header: typeof value.header === 'string' ? value.header : undefined,
        options,
        multiSelect: value.multiSelect === true,
        intent: isRecord(value.intent) && typeof value.intent.kind === 'string'
          ? { kind: value.intent.kind, approve: typeof value.intent.approve === 'string' ? value.intent.approve : undefined }
          : undefined,
      }]
    })
  } catch {
    return []
  }
}

/** Extract safe file diff summaries from opaque dsh tool metadata. */
export function summarizeDiffs(meta: unknown): ChangeSummary[] {
  if (!isRecord(meta) || !Array.isArray(meta.diffs)) return []
  const summaries: ChangeSummary[] = []
  for (const item of meta.diffs.slice(0, 20)) {
    if (!isRecord(item) || typeof item.path !== 'string' || item.path.length === 0 || item.path.length > 1024) continue
    const oldText = item.oldText === null || typeof item.oldText === 'string' ? item.oldText : undefined
    const newText = item.newText === null || typeof item.newText === 'string' ? item.newText : undefined
    if (oldText === undefined || newText === undefined) continue
    const counts = lineChangeCounts(oldText, newText)
    if (counts.added === 0 && counts.removed === 0) continue
    const truncated = (oldText?.length ?? 0) + (newText?.length ?? 0) > 32768
    summaries.push({ path: item.path, ...counts,
      ...(truncated ? { truncated: true } : { oldText, newText }),
    })
  }
  return summaries
}

interface PillRecord {
  pill: SessionPill
  holdTimer: ReturnType<typeof setTimeout> | undefined
  activeCalls: Map<string, string>
  changedPaths: Set<string>
}

/** All pills plus process-global counters behind the dashboard snapshot. */
export class CompanionRegistry {
  private readonly pills = new Map<string, PillRecord>()
  private readonly pendingApprovals: PendingApproval[] = []
  private approvalSeq = 0
  private readonly pendingQuestions = new Map<string, PendingQuestion>()
  /** Local date key → distinct session ids first seen that day. */
  private readonly sessionsByDay = new Map<string, Set<string>>()
  private totals = { toolCalls: 0, turns: 0, approvalsAsked: 0, approvalsAutoAllowed: 0 }

  constructor(
    private readonly options: CompanionOptions = COMPANION_DEFAULTS,
    /** Disposer invoked when a hold timer is armed, so the owner can clear it on unload. */
    private readonly onTimer?: (timer: ReturnType<typeof setTimeout>) => void,
  ) {}

  /** Every live pill, oldest session first. */
  list(): SessionPill[] {
    return [...this.pills.values()].map((record) => record.pill)
  }

  /** Approvals seen asked and not yet seen decided. */
  approvals(): readonly PendingApproval[] {
    return this.pendingApprovals
  }

  /** Questions seen asked and not yet answered. */
  questions(): PendingQuestion[] {
    return [...this.pendingQuestions.values()].map((question) => ({
      ...question,
      questions: question.questions?.map((item) => ({
        ...item,
        options: item.options?.map((option) => ({ ...option })),
        intent: item.intent === undefined ? undefined : { ...item.intent },
      })),
    }))
  }

  /** Process-global counters plus today's distinct session count. */
  totalsOf(now: number): JingleNotchSnapshot['totals'] {
    return {
      sessionsToday: this.sessionsByDay.get(dateKey(now))?.size ?? 0,
      toolCalls: this.totals.toolCalls,
      turns: this.totals.turns,
      approvalsAsked: this.totals.approvalsAsked,
      approvalsAutoAllowed: this.totals.approvalsAutoAllowed,
    }
  }

  /** Serializable state for the dashboard API. */
  snapshot(now: number): JingleNotchSnapshot {
    return {
      now,
      startedAt: this.startedAt,
      sessions: this.list().map((pill) => ({
        ...pill,
        ticker: [...pill.ticker],
        changes: pill.changes.map((change) => ({ ...change })),
        stats: { ...pill.stats },
      })),
      approvals: this.pendingApprovals.map((approval) => ({ ...approval })),
      questions: this.questions(),
      totals: this.totalsOf(now),
    }
  }

  /** Drop every pill, timer, and pending entry; the owning plugin calls this on unload. */
  dispose(): void {
    for (const record of this.pills.values()) {
      if (record.holdTimer !== undefined) clearTimeout(record.holdTimer)
    }
    this.pills.clear()
    this.pendingApprovals.length = 0
    this.pendingQuestions.clear()
  }

  /** Apply one durable session event to the matching pill. */
  observeSession(session: SessionLike, event: SessionEventLike, now: number): void {
    // PTC persists its nested tools with a parallel event envelope.
    if (event.type === 'tool/ptc-dispatch-start' || event.type === 'tool/ptc-dispatch') {
      const d = event.data as { subCallId: string; name: string; arguments: unknown; isError?: boolean; content?: unknown[]; meta?: unknown }
      this.observeSession(session, { ...event,
        type: event.type === 'tool/ptc-dispatch-start' ? 'tool/call' : 'tool/result',
        data: event.type === 'tool/ptc-dispatch-start'
          ? { callId:d.subCallId, name:d.name, arguments:JSON.stringify(d.arguments) }
          : { message:{toolCallId:d.subCallId, isError:d.isError, content:d.content}, meta:d.meta },
      }, now)
      return
    }
    const record = this.ensurePill(session, now)
    record.pill.lastActivityAt = now
    switch (event.type) {
      case 'turn/start': {
        record.pill.stats.turns += 1
        this.totals.turns += 1
        this.setState(record, 'thinking', now)
        break
      }
      case 'user/message': {
        this.setState(record, 'thinking', now)
        const payload = event.data as { content?: readonly unknown[]; message?: { content?: readonly unknown[] } }
        const source = (event.data as { source?: { kind?: string; callId?: string } }).source
        if (source?.kind === 'user-question-reply' && source.callId) this.questionSettled(session.id, source.callId, now)
        const prompt = firstText(payload.content ?? payload.message?.content ?? [])
        if (prompt !== undefined) this.push(record, { t: now, kind: 'prompt', text: oneLine(prompt) })
        break
      }
      case 'assistant/message': {
        const payload = event.data as { message?: { content?: readonly unknown[] }; content?: readonly unknown[] }
        const response = firstText(payload.message?.content ?? payload.content ?? [])
        if (response !== undefined) this.push(record, { t: now, kind: 'response', text: oneLine(response) })
        break
      }
      case 'tool/call': {
        const data = event.data as ToolCallDataLike
        const name = data.name ?? 'tool'
        const label = describeToolCall(name, data.arguments)
        record.pill.stats.toolCalls += 1
        this.totals.toolCalls += 1
        record.pill.currentTool = label
        record.activeCalls.set(data.callId ?? `unknown-${event.seq}`, label)
        record.pill.activeToolCount = record.activeCalls.size
        if (name === QUESTION_TOOL && data.callId !== undefined) {
          const question: PendingQuestion = {
            sessionId: session.id,
            callId: data.callId,
            preview: describeQuestion(data.arguments),
            questions: parseQuestionItems(data.arguments),
            at: now,
          }
          this.pendingQuestions.set(questionKey(session.id, data.callId), question)
          record.pill.stats.questions += 1
          this.push(record, { t: now, kind: 'question', text: oneLine(question.preview) })
          this.setState(record, 'attention', now)
        } else {
          this.push(record, { t: now, kind: 'tool', text: label })
          this.setState(record, 'working', now)
        }
        break
      }
      case 'tool/result': {
        const data = event.data as ToolResultDataLike
        const callId = data.message?.toolCallId
        const questionStillPending = isPendingQuestionResult(data.message?.content)
        if (callId !== undefined && !questionStillPending) {
          const key = questionKey(session.id, callId)
          if (this.pendingQuestions.has(key)) {
            this.pendingQuestions.delete(key)
            if (record.pill.state === 'attention') this.setState(record, 'working', now)
          }
        }
        if (callId !== undefined) record.activeCalls.delete(callId)
        else if (record.activeCalls.size === 1) record.activeCalls.clear()
        record.pill.currentTool = [...record.activeCalls.values()].at(-1)
        record.pill.activeToolCount = record.activeCalls.size
        if (questionStillPending && callId !== undefined) this.setState(record, 'attention', now)
        if (data.message?.isError === true) {
          record.pill.stats.toolErrors += 1
          this.push(record, { t: now, kind: 'tool-error', text: 'tool error' })
        }
        const diffs = summarizeDiffs(data.meta)
        if (diffs.length > 0) this.recordDiffs(record, diffs, now)
        break
      }
      case 'turn/end': {
        record.activeCalls.clear()
        record.pill.currentTool = undefined
        record.pill.activeToolCount = 0
        const kind = (event.data as TurnEndDataLike).reason?.kind
        if (kind === 'completed') {
          this.push(record, { t: now, kind: 'done', text: 'turn completed' })
          this.holdThenIdle(record, 'finished', now)
        } else if (kind === 'error') {
          this.push(record, { t: now, kind: 'failed', text: 'turn failed' })
          this.holdThenIdle(record, 'error', now)
        } else {
          // aborted, blocked, max-tokens, interrupted, forked, and merged
          // plugin variants all return the pill to rest without a celebration.
          this.setState(record, 'idle', now)
        }
        break
      }
      default:
        break
    }
  }

  /**
   * Record an approval ask: pending entry, attention state, ticker line.
   * @returns the created pending entry; its `id` is the decision handle
   *   surfaces answer the request by.
   */
  approvalAsked(session: SessionLike | undefined, request: ApprovalRequestLike, now: number): PendingApproval {
    this.totals.approvalsAsked += 1
    const baseId = request.callId ?? `approval-${String(++this.approvalSeq)}`
    const approval: PendingApproval = {
      id: session?.id === undefined ? baseId : `${session.id}:${baseId}`,
      callId: request.callId,
      toolName: request.toolName,
      reason: request.reason,
      sessionId: session?.id,
      at: now,
    }
    this.pendingApprovals.push(approval)
    if (session !== undefined) {
      const record = this.ensurePill(session, now)
      record.pill.stats.approvals += 1
      this.push(record, { t: now, kind: 'approval', text: `approval: ${request.toolName}` })
      this.setState(record, 'attention', now)
    }
    return approval
  }

  /**
   * Record an approval decision: drop the pending entry by decision id (or by
   * session when the id is unknown) and mirror the outcome on the pill ticker.
   * `undefined` covers decisions whose session closed before the outcome
   * arrived.
   */
  approvalDecided(id: string | undefined, sessionId: string | undefined, outcome: ApprovalOutcomeLike, now: number): void {
    const index = this.pendingApprovals.findIndex((approval) =>
      (id !== undefined && approval.id === id) || (id === undefined && approval.sessionId === sessionId))
    if (index >= 0) this.pendingApprovals.splice(index, 1)
    if (sessionId === undefined) return
    const record = this.pills.get(sessionId)
    if (record === undefined) return
    this.push(record, { t: now, kind: 'approval', text: `approval ${outcome}` })
    if (record.pill.state === 'attention') this.setState(record, outcome === 'allowed-once' ? 'working' : 'idle', now)
  }

  /** Count one auto-allowed approval for the totals strip. */
  approvalAutoAllowed(): void {
    this.totals.approvalsAutoAllowed += 1
  }

  /** Attach structured choices received from the user-questions waterfall. */
  questionRequested(sessionId: string | undefined, callId: string, questions: readonly QuestionItemLike[]): void {
    if (sessionId === undefined) return
    const key = questionKey(sessionId, callId)
    let pending = this.pendingQuestions.get(key)
    if (pending === undefined) {
      pending = { sessionId, callId, preview: oneLine(questions[0]?.question ?? 'Question', 96), at: Date.now() }
      this.pendingQuestions.set(key, pending)
      const record = this.ensurePill({ id: sessionId }, pending.at)
      record.pill.stats.questions += 1
      this.push(record, { t: pending.at, kind: 'question', text: pending.preview })
      this.setState(record, 'attention', pending.at)
    }
    pending.questions = questions.map(question => ({
      ...question, options: question.options?.map(option => ({ ...option })),
      intent: question.intent === undefined ? undefined : { ...question.intent },
    }))
  }

  questionAnswerable(sessionId: string, callId: string, answerable: boolean): void {
    const pending = this.pendingQuestions.get(questionKey(sessionId, callId))
    if (pending) pending.answerable = answerable
  }

  questionQueued(sessionId: string, callId: string, queued: boolean): void {
    const pending = this.pendingQuestions.get(questionKey(sessionId, callId))
    if (pending) pending.replyQueued = queued
  }

  questionSettled(sessionId: string, callId: string, now: number): void {
    this.pendingQuestions.delete(questionKey(sessionId, callId))
    const record = this.pills.get(sessionId)
    if (record?.pill.state === 'attention' && !this.needsAttention(sessionId)) this.setState(record, 'working', now)
  }

  private needsAttention(sessionId: string): boolean {
    return this.pendingApprovals.some(item => item.sessionId === sessionId)
      || [...this.pendingQuestions.values()].some(item => item.sessionId === sessionId)
  }

  /** Latest unanswered question call for a session, used by legacy requests. */
  latestQuestionCallId(sessionId: string | undefined): string | undefined {
    if (sessionId === undefined) return undefined
    return [...this.pendingQuestions.values()].reverse().find((question) => question.sessionId === sessionId)?.callId
  }

  /** Remove the session pill and any pending question it owns. */
  sessionDisposed(session: SessionLike): void {
    const record = this.pills.get(session.id)
    if (record !== undefined) {
      if (record.holdTimer !== undefined) clearTimeout(record.holdTimer)
      this.pills.delete(session.id)
    }
    for (const [key, question] of this.pendingQuestions) {
      if (question.sessionId === session.id) this.pendingQuestions.delete(key)
    }
    for (let index = this.pendingApprovals.length - 1; index >= 0; index -= 1) {
      if (this.pendingApprovals[index]?.sessionId === session.id) this.pendingApprovals.splice(index, 1)
    }
  }

  private startedAt = Date.now()

  private ensurePill(session: SessionLike, now: number): PillRecord {
    const existing = this.pills.get(session.id)
    if (existing !== undefined) return existing
    const cwd = session.header?.cwd ?? session.meta?.cwd
    const pill: SessionPill = {
      id: session.id,
      label: cwd === undefined || cwd.length === 0 ? `session ${session.id.slice(0, 8)}` : basename(cwd),
      cwd,
      state: 'idle',
      stateSince: now,
      startedAt: now,
      lastActivityAt: now,
      ticker: [],
      stats: {
        turns: 0,
        toolCalls: 0,
        toolErrors: 0,
        approvals: 0,
        questions: 0,
        filesChanged: 0,
        linesAdded: 0,
        linesRemoved: 0,
      },
      changes: [],
    }
    const record: PillRecord = { pill, holdTimer: undefined, changedPaths: new Set(), activeCalls: new Map() }
    this.pills.set(session.id, record)
    const day = dateKey(now)
    for (const key of this.sessionsByDay.keys()) if (key !== day) this.sessionsByDay.delete(key)
    const seen = this.sessionsByDay.get(day)
    if (seen === undefined) this.sessionsByDay.set(day, new Set([session.id]))
    else seen.add(session.id)
    return record
  }

  private setState(record: PillRecord, state: PillState, now: number): void {
    if (state !== 'attention' && this.needsAttention(record.pill.id)) state = 'attention'
    if (record.pill.state === state) return
    if (record.holdTimer !== undefined && !HOLD_STATES.has(state)) {
      clearTimeout(record.holdTimer)
      record.holdTimer = undefined
    }
    record.pill.state = state
    record.pill.stateSince = now
  }

  /** Enter `state`, then drop to idle after the hold; an intervening event cancels the timer. */
  private holdThenIdle(record: PillRecord, state: PillState, now: number): void {
    this.setState(record, state, now)
    if (record.holdTimer !== undefined) clearTimeout(record.holdTimer)
    record.holdTimer = setTimeout(() => {
      record.holdTimer = undefined
      if (record.pill.state === state) {
        record.pill.state = 'idle'
        record.pill.stateSince = Date.now()
      }
    }, this.options.finishedHoldMs)
    this.onTimer?.(record.holdTimer)
  }

  private push(record: PillRecord, entry: TickerEntry): void {
    record.pill.ticker.push(entry)
    const overflow = record.pill.ticker.length - this.options.tickerSize
    if (overflow > 0) record.pill.ticker.splice(0, overflow)
  }

  private recordDiffs(record: PillRecord, diffs: readonly ChangeSummary[], now: number): void {
    for (const diff of diffs) {
      const existing = record.pill.changes.find((item) => item.path === diff.path)
      if (existing === undefined) {
        record.pill.changes.push({ ...diff })
        // Bound the distinct-file set; filesChanged is a lower bound past 2048 paths.
        if (record.changedPaths.size < 2048) record.changedPaths.add(diff.path)
        record.pill.stats.filesChanged = record.changedPaths.size
      } else {
        Object.assign(existing, diff)
      }
      record.pill.stats.linesAdded += diff.added
      record.pill.stats.linesRemoved += diff.removed
      this.push(record, { t: now, kind: 'diff', text: `${diff.path} +${String(diff.added)} −${String(diff.removed)}` })
    }
    if (record.pill.changes.length > 20) record.pill.changes.splice(0, record.pill.changes.length - 20)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPendingQuestionResult(content: readonly unknown[] | undefined): boolean {
  const text = firstText(content ?? [])
  if (text === undefined) return false
  try {
    const parsed: unknown = JSON.parse(text)
    return isRecord(parsed) && parsed.pending === true && typeof parsed.callId === 'string'
  } catch {
    return false
  }
}

function lineChangeCounts(oldText: string | null, newText: string | null): { added: number; removed: number; approximate?: boolean } {
  if ((oldText?.length ?? 0) + (newText?.length ?? 0) > 1_000_000) {
    const count = (text: string | null): number => text === null || text === '' ? 0 : (text.match(/\n/gu)?.length ?? 0) + (text.endsWith('\n') ? 0 : 1)
    return { added:count(newText), removed:count(oldText), approximate:true }
  }
  const oldLines = oldText === null ? [] : effectiveLines(oldText)
  const newLines = newText === null ? [] : effectiveLines(newText)
  if (oldText === null) return { added: nonEmptyLineCount(newLines), removed: 0 }
  if (newText === null) return { added: 0, removed: nonEmptyLineCount(oldLines) }
  const lcs = oldLines.length <= 2000 && newLines.length <= 2000
    ? longestCommonSubsequenceLength(oldLines, newLines)
    : commonEdgeLength(oldLines, newLines)
  return { added: Math.max(0, newLines.length - lcs), removed: Math.max(0, oldLines.length - lcs), ...(oldLines.length > 2000 || newLines.length > 2000 ? { approximate:true } : {}) }
}

function nonEmptyLineCount(lines: readonly string[]): number {
  return lines.length === 1 && lines[0] === '' ? 0 : lines.length
}

function effectiveLines(text: string): string[] {
  const lines = text.split(/\r?\n/u)
  if (lines.at(-1) === '') lines.pop()
  return lines
}

function longestCommonSubsequenceLength(left: readonly string[], right: readonly string[]): number {
  const row = new Uint32Array(right.length + 1)
  for (const leftLine of left) {
    let diagonal = 0
    for (let column = 1; column <= right.length; column += 1) {
      const previous = row[column]
      row[column] = leftLine === right[column - 1] ? diagonal + 1 : Math.max(row[column], row[column - 1])
      diagonal = previous
    }
  }
  return row[right.length] ?? 0
}

function commonEdgeLength(left: readonly string[], right: readonly string[]): number {
  let prefix = 0
  while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) prefix += 1
  let suffix = 0
  while (suffix < left.length - prefix && suffix < right.length - prefix
    && left[left.length - suffix - 1] === right[right.length - suffix - 1]) suffix += 1
  return prefix + suffix
}

function questionKey(sessionId: string, callId: string): string {
  return `${sessionId}\u0000${callId}`
}

/** Local date key (YYYY-MM-DD) used for the sessions-today counter. */
export function dateKey(now: number): string {
  const date = new Date(now)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${String(date.getFullYear())}-${month}-${day}`
}
