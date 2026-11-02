import { describe, expect, it } from 'vitest'
import { QuestionAnswers } from '../src/question-answers.ts'

const ANSWER = { answers: [{ id: 'choice', selected: ['Allow'] }] }

describe('question surface channel', () => {
  it('delivers a structured answer to the waiting question', async () => {
    const channel = new QuestionAnswers()
    const waiting = channel.wait('session:call', undefined)
    expect(channel.answer('session:call', ANSWER)).toBe(true)
    await expect(waiting).resolves.toEqual(ANSWER)
    expect(channel.size).toBe(0)
  })

  it('rejects malformed answer batches', () => {
    const channel = new QuestionAnswers()
    channel.wait('q1', undefined)
    expect(channel.answer('q1', { answers: 'bad' } as never)).toBe(false)
    expect(channel.answer('q1', { answers: [] })).toBe(true)
    expect(channel.answer('q1', { answers: [] })).toBe(false)
  })

  it('settles cancelled and pre-aborted waits', async () => {
    const channel = new QuestionAnswers()
    const controller = new AbortController()
    const waiting = channel.wait('q2', controller.signal)
    controller.abort()
    await expect(waiting).resolves.toBeUndefined()
    const already = new AbortController()
    already.abort()
    await expect(channel.wait('q3', already.signal)).resolves.toBeUndefined()
  })
})
