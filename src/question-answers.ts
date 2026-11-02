/**
 * Small in-process answer channel used by the dashboard and overlay. The
 * service validates against the question schema; this channel routes a
 * surface response to the request currently waiting on that waterfall.
 */

export interface QuestionAnswerItem {
  id: string
  selected: string[]
  custom?: string
}

export interface QuestionAnswer {
  answers: QuestionAnswerItem[]
}

interface Entry {
  resolve: (answer: QuestionAnswer | undefined) => void
  abort?: () => void
}

export class QuestionAnswers {
  private readonly pending = new Map<string, Entry>()

  get size(): number {
    return this.pending.size
  }

  wait(id: string, signal: AbortSignal | undefined): Promise<QuestionAnswer | undefined> {
    if (signal?.aborted) return Promise.resolve(undefined)
    this.cancel(id)
    return new Promise((resolve) => {
      const entry: Entry = { resolve }
      if (signal !== undefined) {
        const abort = (): void => {
          this.pending.delete(id)
          resolve(undefined)
        }
        signal.addEventListener('abort', abort, { once: true })
        entry.abort = () => signal.removeEventListener('abort', abort)
      }
      this.pending.set(id, entry)
    })
  }

  answer(id: string, answer: QuestionAnswer): boolean {
    const entry = this.pending.get(id)
    if (entry === undefined || !isAnswer(answer)) return false
    this.pending.delete(id)
    entry.abort?.()
    entry.resolve(answer)
    return true
  }

  cancel(id: string): boolean {
    const entry = this.pending.get(id)
    if (entry === undefined) return false
    this.pending.delete(id)
    entry.abort?.()
    entry.resolve(undefined)
    return true
  }

  cancelAll(): void {
    for (const id of [...this.pending.keys()]) this.cancel(id)
  }

  dispose(): void {
    this.cancelAll()
  }
}

function isAnswer(value: unknown): value is QuestionAnswer {
  if (typeof value !== 'object' || value === null || !Array.isArray((value as { answers?: unknown }).answers)) return false
  return (value as { answers: unknown[] }).answers.every((item) => {
    if (typeof item !== 'object' || item === null) return false
    const candidate = item as { id?: unknown; selected?: unknown; custom?: unknown }
    return typeof candidate.id === 'string'
      && Array.isArray(candidate.selected)
      && candidate.selected.every((label) => typeof label === 'string')
      && (candidate.custom === undefined || typeof candidate.custom === 'string')
  })
}

/** Validate the complete batch against the exact questions shown to the user. */
export function validQuestionAnswer(value: unknown, questions: readonly import('./types.ts').QuestionItemLike[]): value is QuestionAnswer {
  if (!isAnswer(value) || value.answers.length !== questions.length) return false
  const ids = new Set(value.answers.map(item => item.id))
  if (ids.size !== questions.length) return false
  return questions.every(question => {
    const item = value.answers.find(answer => answer.id === question.id)
    if (item === undefined || new Set(item.selected).size !== item.selected.length) return false
    if (item.selected.some(label => !question.options?.some(option => option.label === label))) return false
    if (!question.multiSelect && (item.selected.length > 1 || (item.custom?.trim() && item.selected.length))) return false
    return (item.custom?.length ?? 0) <= 16384 && item.id.length <= 1024
  })
}
