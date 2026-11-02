/**
 * Type-level view of the dsh Cordis events this plugin listens to, declared
 * through module augmentation so `ctx.on(...)` typechecks when this package
 * compiles standalone. The members mirror the host's own declarations
 * (`@deepseek-ai/dsh-session`, `@deepseek-ai/dsh-user-approval`) with the
 * structural views from `./types.ts`; the built bundle carries no type
 * information, so the host runtime never sees both spellings at once.
 */
import type { JingleNotchService } from './index.ts'
import type {
  ApprovalOutcomeLike, ApprovalRequestLike, SessionEventLike, SessionLike, UserQuestionRequestLike, QuestionAnswerLike,
} from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Events {
    'agent/inbox/discarded': (event: { agent: { id: string; session: SessionLike }; message: { source: { kind: string; callId?: string } } }) => void
    /** Durable append on one session: lifecycle, messages, tool calls/results. */
    'session/event': (session: SessionLike, event: SessionEventLike) => void
    /** The session store released one session. */
    'session/disposed': (session: SessionLike) => void
    /**
     * Ask composed answerers for one approval decision; return an outcome to
     * claim the request or call `next()` to delegate downstream.
     */
    'approval/request': (req: ApprovalRequestLike, next: () => Promise<ApprovalOutcomeLike>) => Promise<ApprovalOutcomeLike>
    /** Structured human question answerer waterfall. */
    'user-questions/request': (req: UserQuestionRequestLike, next: () => Promise<QuestionAnswerLike>) => Promise<QuestionAnswerLike>
  }

  interface Context {
    /** The jingleNotch companion service provided by `dsh-jingle-notch`. */
    jingleNotch: JingleNotchService
    /** Optional dsh user-question service used for timed continued questions. */
    userQuestions?: { answer(agent: unknown, callId: string, answer: QuestionAnswerLike): boolean }
  }
}
