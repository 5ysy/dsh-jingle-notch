// A real Cordis engine and dashboard, driven by synthetic non-sensitive sessions.
import { createServer } from 'node:http'
import { Context } from '@deepseek-ai/cordis'
import JingleNotchService from '../../lib/index.js'
import * as dashboard from '../../lib/dashboard.js'
const ctx = new Context(), routes = []
const smokeActions = new Map()
// Native answerers remain pending while the JingleNotch surface is exercised.
const nativeLifetime = new AbortController()
const nativeQuestion = () => new Promise((resolve, reject) => {
  nativeLifetime.signal.addEventListener('abort', () => reject(Object.assign(new Error('Smoke host stopped'), { code: 'ASK_ABORTED' })), { once: true })
})
const nativeApproval = () => new Promise(resolve => {
  nativeLifetime.signal.addEventListener('abort', () => resolve('cancelled'), { once: true })
})
await ctx.plugin(JingleNotchService, {recap:{enabled:false},notifications:{enabled:false},sounds:{enabled:false}})
const server = createServer((req,res)=>{
  const path = new URL(req.url,'http://localhost').pathname
  if (req.method === 'POST' && smokeActions.has(path)) {
    try { smokeActions.get(path)(); res.writeHead(200);res.end('ok') }
    catch (error) { process.stderr.write(`SMOKE action failed (${path}): ${String(error)}\n`);res.writeHead(500);res.end('Fixture action failed') }
    return
  }
  const route = routes.find(r=>r.kind==='exact'?path===r.path:path===r.path||path.startsWith(r.path+'/'))
  if(route)void route.handler(req,res)
  else{res.writeHead(404);res.end()}
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const origin = `http://127.0.0.1:${server.address().port}`
ctx.provide('webServer',{register:r=>{routes.push(r);return()=>{}},getOrigin:()=>origin})
ctx.provide('connection',{admit:()=>({rejection:401})})
await ctx.plugin(dashboard)
ctx.jingleNotch.surfaceSeen()
const heartbeat=setInterval(()=>ctx.jingleNotch.surfaceSeen(),1000)
const session = {id:'smoke',header:{cwd:'/demo/companion'}}
for (const [id, cwd, tool] of [['api','/demo/api','read_file'],['web','/demo/web','bash'],['tests','/demo/tests','search']]) {
  const other={id,header:{cwd}}
  ctx.emit('session/event',other,{type:'turn/start',data:{},seq:1,time:Date.now()})
  ctx.emit('session/event',other,{type:'tool/call',data:{callId:id,name:tool,arguments:'{}'},seq:2,time:Date.now()})
}
for (const id of ['idle-1','idle-2','idle-3','idle-4']) {
  const other={id,header:{cwd:`/demo/${id}`}}
  ctx.emit('session/event',other,{type:'turn/start',data:{},seq:1,time:Date.now()})
  ctx.emit('session/event',other,{type:'turn/end',data:{reason:{kind:'completed'}},seq:2,time:Date.now()})
}
let injected
smokeActions.set('/__smoke/request-web',()=>{
  if(injected)throw new Error('A follow-up question is already pending')
  injected=new AbortController()
  const request={agent:{id:'web'},wait:{callId:'follow-up'},signal:injected.signal,questions:[{id:'continue',question:'Native attention follow-up',options:[{label:'Continue'}]}]}
  ctx.waterfall('user-questions/request',request,nativeQuestion)
    .catch(error=>{if(error?.name!=='AbortError'&&error?.code!=='ASK_ABORTED')process.stderr.write(`FOLLOW-UP ${String(error)}\n`)})
})
smokeActions.set('/__smoke/withdraw-web',()=>{injected?.abort();injected=undefined})
smokeActions.set('/__smoke/finish-api',()=>{
  const other={id:'api',header:{cwd:'/demo/api'}}
  ctx.emit('session/event',other,{type:'tool/result',data:{message:{toolCallId:'api'}},seq:3,time:Date.now()})
  ctx.emit('session/event',other,{type:'turn/end',data:{reason:{kind:'completed'}},seq:4,time:Date.now()})
})
let seq=0
const emit=(type,data)=>ctx.emit('session/event',session,{type,data,seq:++seq,time:Date.now()})
emit('turn/start',{})
emit('tool/call',{callId:'write',name:'write_file',arguments:JSON.stringify({path:'demo.ts'})})
emit('tool/result',{message:{toolCallId:'write'},meta:{diffs:[{path:'demo.ts',oldText:'const ready = false\n',newText:'const ready = true\n'}]}})
const question = {
  agent:{id:'smoke'},wait:{callId:'question'},questions:[
    {id:'plan',question:'Review the full implementation plan',detail:'# macOS companion\n\nReserve the physical notch center.\nKeep question drafts across polls.\nUse sandboxed renderer IPC.\n\nEND OF COMPLETE PLAN', options:[{label:'Approve "exact" plan',description:'Accept the plan in full.'},{label:'Request changes'}],intent:{kind:'plan-review',approve:'Approve "exact" plan',callId:'question'}},
    {id:'checks',question:'Which checks should run?',multiSelect:true,options:[{label:'Types'},{label:'Tests'},{label:'Build'}]},
  ],
}
const q = ctx.waterfall('user-questions/request',question,nativeQuestion)
q.then(answer=>process.stdout.write(`ANSWER ${JSON.stringify(answer)}\n`)).catch(error=>process.stderr.write(`QUESTION ${error}\n`))
const approval=ctx.waterfall('approval/request',{agent:{id:'smoke'},toolName:'bash',reason:'Run the verification suite',callId:'approval'},nativeApproval)
approval.then(answer=>process.stdout.write(`APPROVAL ${answer}\n`))
process.stdout.write(`ORIGIN ${origin}\n`)
async function close(){clearInterval(heartbeat);nativeLifetime.abort();await ctx.registry.delete(dashboard);await ctx.registry.delete(JingleNotchService);server.closeAllConnections();server.close(()=>process.exit(0))}
process.on('SIGTERM',()=>void close())
