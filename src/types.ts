/**
 * Structural views of the dsh public vocabularies dsh-jingle-notch consumes.
 *
 * The plugin reads live Cordis events only, so these minimal shapes mirror the
 * session event envelope (`@deepseek-ai/dsh-session`), the message model
 * (`@deepseek-ai/dsh-llm`), and the approval request
 * (`@deepseek-ai/dsh-user-approval`) without importing host packages at
 * runtime. Field additions on the host side stay compatible; removals are a
 * release-note matter for the matching dsh version range in `package.json`.
 */

/** Companion pill state, mirroring jingleNotch's pill lifecycle. */
export type PillState = 'idle' | 'thinking' | 'working' | 'attention' | 'finished' | 'error'

/** Structural view of one durable session, as delivered by `session/event`. */
export interface SessionLike {
  /** Stable session identity. */
  readonly id: string
  /** Durable creation metadata; `cwd` labels the pill with the workspace name. */
  readonly header?: { readonly cwd?: string }
  /** Compatibility view for lightweight adapters that expose legacy metadata. */
  readonly meta?: { readonly cwd?: string }
}

/** Structural view of the append-only session event envelope. */
export interface SessionEventLike {
  readonly type: string
  readonly seq: number
  /** Unix epoch milliseconds. */
  readonly time: number
  readonly data: unknown
}

/** Textual content of one text block; other block kinds carry no preview text. */
export interface TextBlockLike {
  readonly type: string
  readonly text?: string
}

/** Tool result payload fields the companion reads. */
export interface ToolResultDataLike {
  readonly message?: { readonly toolCallId?: string; readonly isError?: boolean; readonly content?: readonly unknown[] }
  readonly meta?: unknown
}

/** A validated file change summary derived from tool result metadata. */
export interface ChangeSummary {
  path: string
  added: number
  removed: number
  oldText?: string | null
  newText?: string | null
  truncated?: boolean
  approximate?: boolean
}

/** Tool call payload fields the companion reads. */
export interface ToolCallDataLike {
  readonly callId?: string
  readonly name?: string
  /** Raw JSON text exactly as the model produced it. */
  readonly arguments?: string
}

/** Turn end payload fields the companion reads. */
export interface TurnEndDataLike {
  readonly reason?: { readonly kind?: string }
}

/** Structural view of a pending approval request from `approval/request`. */
export interface ApprovalRequestLike {
  readonly toolName: string
  readonly callId?: string
  readonly reason?: string
  readonly agent?: { readonly id?: string }
  /** Aborting withdraws the question; mirrors dsh's `ApprovalRequest.signal`. */
  readonly signal?: AbortSignal
}

/** Closed approval outcome vocabulary, mirroring dsh's fail-closed union. */
export type ApprovalOutcomeLike = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'

/** One ticker line: a bounded, human-readable activity record. */
export interface TickerEntry {
  /** Unix epoch milliseconds. */
  t: number
  kind: 'prompt' | 'response' | 'tool' | 'tool-error' | 'diff' | 'approval' | 'question' | 'done' | 'failed'
  text: string
}

/** Per-session counters accumulated while the session is observed. */
export interface SessionStats {
  turns: number
  toolCalls: number
  toolErrors: number
  approvals: number
  questions: number
  filesChanged: number
  linesAdded: number
  linesRemoved: number
}

/** One session pill: live state plus its recent activity. */
export interface SessionPill {
  id: string
  label: string
  cwd?: string
  state: PillState
  /** Unix epoch milliseconds when `state` was entered. */
  stateSince: number
  startedAt: number
  lastActivityAt: number
  /** Tool label currently executing, when one is open. */
  currentTool?: string
  activeToolCount?: number
  ticker: TickerEntry[]
  changes: ChangeSummary[]
  stats: SessionStats
}

/** One approval waiting on a human, with the id surfaces answer it by. */
export interface PendingApproval {
  /** Opaque decision id; `POST /jingle/api/approvals/:id` answers this request. */
  id: string
  /** Original tool call id, when the request was attached to one. */
  callId?: string
  toolName: string
  answerable?: boolean
  reason?: string
  /** Session id the request belongs to, when routable. */
  sessionId?: string
  at: number
}

/** One pending `ask_user_question` tool call awaiting an answer. */
export interface PendingQuestion {
  sessionId: string
  callId: string
  /** Short argument preview shown while the question waits. */
  preview: string
  answerable?: boolean
  replyQueued?: boolean
  questions?: QuestionItemLike[]
  at: number
}

export interface QuestionOptionLike {
  label: string
  description?: string
}

export interface QuestionItemLike {
  id: string
  question: string
  detail?: string
  header?: string
  options?: QuestionOptionLike[]
  multiSelect?: boolean
  intent?: { kind?: string; approve?: string; callId?: string }
}

export interface QuestionAnswerItemLike {
  id: string
  selected: string[]
  custom?: string
}

export interface QuestionAnswerLike {
  answers: QuestionAnswerItemLike[]
}

export interface UserQuestionRequestLike {
  questions: QuestionItemLike[]
  agent?: { id?: string; session?: { id?: string } }
  signal?: AbortSignal
  wait?: { callId?: string; timed?: boolean }
}

/** Serializable state served by the dashboard API. */
export interface JingleNotchSnapshot {
  recap?: import('./recap.ts').RecapSnapshot
  now: number
  startedAt: number
  sessions: SessionPill[]
  approvals: PendingApproval[]
  questions: PendingQuestion[]
  totals: {
    sessionsToday: number
    toolCalls: number
    turns: number
    approvalsAsked: number
    approvalsAutoAllowed: number
  }
}
