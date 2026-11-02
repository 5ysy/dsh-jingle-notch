import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import JingleNotchService from '../src/index.ts'
import type { JingleNotchConfig } from '../src/config.ts'
import type { QuestionAnswerLike, UserQuestionRequestLike } from '../src/types.ts'

const contexts: Context[] = []
afterEach(async () => { for (const ctx of contexts.splice(0)) await ctx.registry.delete(JingleNotchService) })
const config: JingleNotchConfig = {
  notifications: { enabled: false, onApproval: false, onQuestion: false, onTurnEnd: false },
  sounds: { enabled: false, onApproval: false, onQuestion: false, onFinish: false },
  recap:{enabled:false}, autoAllowTools: [], overlay: { enabled: true, autoStart: false, electronPath: '', yOffset: 0 },
  finishedHoldMs: 0, tickerSize: 30,
}
async function setup() {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(JingleNotchService, config)
  ctx.jingleNotch.enableQuestionSurface()
  ctx.jingleNotch.surfaceSeen()
  return ctx
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(res => { resolve = res })
  return { promise, resolve }
}
const questions = [{ id: 'review', question: 'Accept plan?', detail: '# Full plan\nReview this.', options: [{ label: 'Approve' }, { label: 'Revise' }], intent: { kind: 'plan-review', approve: 'Approve', callId: 'plan-call' } }]
const answer = { answers: [{ id: 'review', selected: ['Approve'] }] }
const request = (): UserQuestionRequestLike => ({ agent: { id: 's1' }, questions, wait: { callId: 'plan-call' } })

describe('service surface routing', () => {
  it('allows dashboard approvals while Electron is closed', async () => {
    const ctx = await setup()
    const downstream = deferred<'allowed-once'>()
    ctx.on('approval/request', () => downstream.promise)
    const result = ctx.waterfall('approval/request', { toolName: 'bash', callId: 'a', agent: { id: 's1' } }, async () => 'unavailable')
    const id = ctx.jingleNotch.snapshot().approvals[0]!.id
    expect(ctx.jingleNotch.answerApproval(id, 'allowed-once')).toBe(true)
    await expect(result).resolves.toBe('allowed-once')
    downstream.resolve('allowed-once')
    expect(ctx.jingleNotch.snapshot().approvals).toEqual([])
  })

  it('passes an approval to the native session answerer while the overlay is active', async () => {
    const ctx = await setup()
    const native = deferred<'rejected'>()
    const next = vi.fn(() => native.promise)
    ctx.on('approval/request', next)
    const result = ctx.waterfall('approval/request', { toolName: 'bash', callId: 'dual-a', agent: { id: 's1' } }, async () => 'unavailable')
    const id = ctx.jingleNotch.snapshot().approvals[0]!.id
    await Promise.resolve()
    expect(next).toHaveBeenCalledTimes(1)
    expect(ctx.jingleNotch.answerApproval(id, 'allowed-once')).toBe(true)
    await expect(result).resolves.toBe('allowed-once')
    native.resolve('rejected')
  })

  it('lets the native answerer win and releases the overlay waiter', async () => {
    const ctx = await setup()
    const native = vi.fn(async () => 'rejected' as const)
    ctx.on('approval/request', native)
    const result = ctx.waterfall('approval/request', { toolName: 'bash', callId: 'dual-b', agent: { id: 's1' } }, async () => 'unavailable')
    const id = ctx.jingleNotch.snapshot().approvals[0]!.id
    await expect(result).resolves.toBe('rejected')
    expect(ctx.jingleNotch.answerApproval(id, 'allowed-once')).toBe(false)
  })
  it('creates plan-review cards without an ask_user_question call', async () => {
    const ctx = await setup()
    const downstream = deferred<QuestionAnswerLike>()
    ctx.on('user-questions/request', () => downstream.promise)
    const result = ctx.waterfall('user-questions/request', request(), () => downstream.promise)
    expect(ctx.jingleNotch.snapshot().questions[0]).toMatchObject({ sessionId: 's1', callId: 'plan-call', questions })
    expect(ctx.jingleNotch.answerQuestion('s1', 'plan-call', answer)).toBe(true)
    await expect(result).resolves.toEqual(answer)
    downstream.resolve(answer)
    expect(ctx.jingleNotch.snapshot().questions).toEqual([])
  })

  it('passes a question to the native session answerer while the overlay is active', async () => {
    const ctx = await setup()
    const native = deferred<QuestionAnswerLike>()
    const next = vi.fn(() => native.promise)
    ctx.on('user-questions/request', next)
    const result = ctx.waterfall('user-questions/request', request(), () => native.promise)
    await Promise.resolve()
    expect(next).toHaveBeenCalledTimes(1)
    expect(ctx.jingleNotch.answerQuestion('s1', 'plan-call', answer)).toBe(true)
    await expect(result).resolves.toEqual(answer)
    native.resolve(answer)
  })

  it('removes the JingleNotch question waiter after the native answer wins', async () => {
    const ctx = await setup()
    ctx.on('user-questions/request', () => Promise.resolve(answer))
    const result = ctx.waterfall('user-questions/request', request(), () => Promise.resolve(answer))
    await expect(result).resolves.toEqual(answer)
    expect(ctx.jingleNotch.answerQuestion('s1', 'plan-call', answer)).toBe(false)
  })
  it('rejects labels that were never offered and incomplete batches', async () => {
    const ctx = await setup()
    const downstream = deferred<QuestionAnswerLike>()
    ctx.on('user-questions/request', () => downstream.promise)
    const result = ctx.waterfall('user-questions/request', request(), () => downstream.promise)
    expect(ctx.jingleNotch.answerQuestion('s1', 'plan-call', { answers: [] })).toBe(false)
    expect(ctx.jingleNotch.answerQuestion('s1', 'plan-call', { answers: [{ id: 'review', selected: ['forged'] }] })).toBe(false)
    expect(ctx.jingleNotch.answerQuestion('s1', 'plan-call', answer)).toBe(true)
    await expect(result).resolves.toEqual(answer)
    downstream.resolve(answer)
  })
  it('preserves an explicit downstream cancellation', async () => {
    const ctx = await setup()
    ctx.jingleNotch.disableQuestionSurface()
    const error = Object.assign(new Error('cancelled'), { code: 'ASK_CANCELLED' })
    ctx.on('user-questions/request', () => Promise.reject(error))
    const result = ctx.waterfall('user-questions/request', request(), () => Promise.reject(error))
    await expect(Promise.race([result.catch(e => e), new Promise(resolve => setTimeout(() => resolve('hung'), 30))])).resolves.toBe(error)
    expect(ctx.jingleNotch.snapshot().questions).toEqual([])
  })
  it('does not call next twice when aborted', async () => {
    const ctx = await setup()
    const controller = new AbortController()
    const downstream = deferred<QuestionAnswerLike>()
    const next = vi.fn(() => downstream.promise)
    ctx.on('user-questions/request', next)
    const result = ctx.waterfall('user-questions/request', { ...request(), signal: controller.signal }, () => downstream.promise)
    controller.abort()
    const error = await Promise.race([result.catch(e => e), new Promise(resolve => setTimeout(() => resolve('hung'), 30))])
    expect(error).toMatchObject({ code: 'ASK_ABORTED' })
    expect(next).toHaveBeenCalledTimes(0)
    downstream.resolve(answer)
  })
})

it('keeps timed questions through turn/end and accepts a continued answer',async()=>{
  const ctx=await setup(), controller=new AbortController()
  const noProvider=()=>Promise.reject(Object.assign(new Error('none'),{code:'NO_PROVIDER'}))
  ctx.on('user-questions/request',noProvider)
  const result=ctx.waterfall('user-questions/request',{...request(),wait:{callId:'plan-call',timed:true},signal:controller.signal},noProvider)
  controller.abort(Object.assign(new Error('timed out'),{code:'ASK_TIMED_OUT'}))
  await expect(result).rejects.toMatchObject({code:'ASK_TIMED_OUT'})
  ctx.emit('session/event',{id:'s1'},{type:'turn/end',seq:1,time:Date.now(),data:{reason:{kind:'completed'}}})
  expect(ctx.jingleNotch.snapshot().questions).toHaveLength(1)
  expect(ctx.jingleNotch.snapshot().sessions[0].state).toBe('attention')
  const answerLate=vi.fn(()=>true)
  ctx.provide('userQuestions',{answer:answerLate})
  expect(ctx.jingleNotch.answerQuestion('s1','plan-call',answer)).toBe(true)
  expect(answerLate).toHaveBeenCalledWith({id:'s1'},'plan-call',answer)
  expect(ctx.jingleNotch.snapshot().questions[0]).toMatchObject({replyQueued:true})
  ctx.emit('agent/inbox/discarded',{agent:{id:'s1',session:{id:'s1'}},message:{source:{kind:'user-question-reply',callId:'plan-call'}}})
  expect(ctx.jingleNotch.snapshot().questions[0].replyQueued).toBe(false)
})
it('closes a continued card when the host admits a late reply',async()=>{
  const ctx=await setup(),controller=new AbortController()
  const result=ctx.waterfall('user-questions/request',{...request(),wait:{callId:'plan-call',timed:true},signal:controller.signal},()=>new Promise(()=>{}))
  controller.abort(Object.assign(new Error('timed out'),{code:'ASK_TIMED_OUT'}))
  await expect(result).rejects.toMatchObject({code:'ASK_TIMED_OUT'})
  ctx.emit('session/event',{id:'s1'},{type:'user/message',seq:1,time:Date.now(),data:{source:{kind:'user-question-reply',callId:'plan-call'},content:[]}})
  expect(ctx.jingleNotch.snapshot().questions).toHaveLength(0)
})
it('scopes Always to the originating session and ignores expired submissions',async()=>{
  const ctx=await setup()
  const req=(sid:string,callId:string)=>({agent:{id:sid},toolName:'bash',callId})
  const first=ctx.waterfall('approval/request',req('s1','a'),async()=> 'unavailable')
  const id=ctx.jingleNotch.snapshot().approvals[0].id
  expect(ctx.jingleNotch.answerApproval('expired','always')).toBe(false)
  expect(ctx.jingleNotch.answerApproval(id,'always')).toBe(true)
  await expect(first).resolves.toBe('allowed-once')
  await expect(ctx.waterfall('approval/request',req('s1','b'),async()=> 'rejected')).resolves.toBe('allowed-once')
  ctx.jingleNotch.disableQuestionSurface()
  await expect(ctx.waterfall('approval/request',req('s2','c'),async()=> 'rejected')).resolves.toBe('rejected')
})
it('delegates to the same downstream promise when the dashboard unloads',async()=>{
  const ctx=await setup(), pending=deferred<QuestionAnswerLike>()
  const next=vi.fn(()=>pending.promise)
  ctx.on('user-questions/request',next)
  const result=ctx.waterfall('user-questions/request',request(),()=>pending.promise)
  await Promise.resolve()
  ctx.jingleNotch.disableQuestionSurface()
  pending.resolve(answer)
  await expect(result).resolves.toEqual(answer)
  expect(next).toHaveBeenCalledTimes(1)
})
it('uses a frozen caller request without mutating its signal while sharing the native surface',async()=>{
  const ctx=await setup(),controller=new AbortController(),next=vi.fn(async()=> 'rejected' as const)
  ctx.on('approval/request',next)
  const req=Object.freeze({agent:{id:'s1'},toolName:'bash',callId:'frozen',signal:controller.signal})
  const result=ctx.waterfall('approval/request',req,async()=> 'unavailable')
  await Promise.resolve()
  expect(next).toHaveBeenCalledTimes(1)
  expect(ctx.jingleNotch.answerApproval(ctx.jingleNotch.snapshot().approvals[0].id,'allowed-once')).toBe(true)
  await expect(result).resolves.toBe('allowed-once')
  expect(next).toHaveBeenCalledTimes(1)
  expect(req.signal).toBe(controller.signal)
  expect(req.signal.aborted).toBe(false)
})
it('delegates immediately when no dashboard or overlay is actually polling',async()=>{
  const ctx=new Context();contexts.push(ctx);await ctx.plugin(JingleNotchService,config)
  ctx.jingleNotch.enableQuestionSurface()
  const next=vi.fn(async()=> 'rejected' as const)
  ctx.on('approval/request',next)
  await expect(ctx.waterfall('approval/request',{agent:{id:'s1'},toolName:'bash'},async()=> 'unavailable')).resolves.toBe('rejected')
  expect(next).toHaveBeenCalledTimes(1)
})
it('receives requests when a terminal host answerer registered before the plugin',async()=>{
  const ctx=new Context();contexts.push(ctx)
  const official=vi.fn(async()=> 'rejected' as const)
  const officialQuestion=vi.fn(async()=>answer)
  ctx.on('approval/request',official)
  ctx.on('user-questions/request',officialQuestion)
  await ctx.plugin(JingleNotchService,config)
  ctx.jingleNotch.enableQuestionSurface();ctx.jingleNotch.surfaceSeen()
  const result=ctx.waterfall('approval/request',{agent:{id:'s1'},toolName:'bash',callId:'ordered'},async()=> 'unavailable')
  expect(ctx.jingleNotch.snapshot().approvals).toHaveLength(1)
  expect(ctx.jingleNotch.answerApproval(ctx.jingleNotch.snapshot().approvals[0].id,'allowed-once')).toBe(true)
  await expect(result).resolves.toBe('allowed-once')
  expect(official).toHaveBeenCalledTimes(1)
  const question=ctx.waterfall('user-questions/request',request(),async()=>answer)
  expect(ctx.jingleNotch.answerQuestion('s1','plan-call',answer)).toBe(true)
  await expect(question).resolves.toEqual(answer)
  expect(officialQuestion).toHaveBeenCalledTimes(1)
})
it('withdraws surface requests when their owning session is disposed',async()=>{
 const ctx=await setup(),official=vi.fn(async()=> 'rejected' as const)
 ctx.on('approval/request',official)
 const approval=ctx.waterfall('approval/request',{agent:{id:'s1'},toolName:'bash',callId:'dispose'},async()=> 'unavailable')
 const question=ctx.waterfall('user-questions/request',request(),async()=>answer)
 ctx.emit('session/disposed',{id:'s1'})
 await expect(approval).resolves.toBe('cancelled')
 await expect(question).rejects.toMatchObject({code:'ASK_ABORTED'})
 expect(official).toHaveBeenCalledTimes(1)
 expect(ctx.jingleNotch.snapshot().approvals).toEqual([])
 expect(ctx.jingleNotch.snapshot().questions).toEqual([])
})
it('hands off once after the last polling surface expires',async()=>{
 const ctx=await setup(),official=vi.fn(async()=> 'rejected' as const)
 ctx.on('approval/request',official)
 const pending=ctx.waterfall('approval/request',{agent:{id:'s1'},toolName:'bash',callId:'offline'},async()=> 'unavailable')
 const clock=vi.spyOn(Date,'now').mockReturnValue(Date.now()+7000)
 try{
  await expect(pending).resolves.toBe('rejected')
  expect(official).toHaveBeenCalledTimes(1)
 }finally{clock.mockRestore()}
})
it('can stop an absent overlay repeatedly without disposing the companion',async()=>{
 const ctx=await setup()
 expect(ctx.jingleNotch.stopOverlay()).toEqual({ok:true,message:'overlay: not running'})
 expect(ctx.jingleNotch.stopOverlay().ok).toBe(true)
 expect(ctx.jingleNotch.snapshot()).toHaveProperty('sessions')
})
