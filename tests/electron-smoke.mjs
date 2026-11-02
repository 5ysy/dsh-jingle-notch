// Optional native integration check. Use a configured Electron executable without adding dependencies.
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const require=createRequire(import.meta.url)
let binary=process.env.JINGLE_NOTCH_ELECTRON
if(!binary){try{binary=require('electron')}catch{throw new Error('Set JINGLE_NOTCH_ELECTRON to an installed Electron executable.')}}
const cwd=fileURLToPath(new URL('../',import.meta.url))
const nativeIme=process.argv.includes('--ime')
const host=spawn(process.execPath,['tests/fixtures/smoke-host.mjs'],{cwd,stdio:['ignore','pipe','inherit']})
let output=''
try{
 const origin=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Smoke host startup timed out')),10000)
  host.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/ORIGIN (http:\/\/\S+)/);if(match){clearTimeout(timer);resolve(match[1])}})
  host.on('error',reject)
  host.once('exit',code=>{clearTimeout(timer);reject(new Error(`Smoke host exited ${code}`))})
 })
 const environment={...process.env};delete environment.ELECTRON_RUN_AS_NODE
 const child=spawn(binary,[nativeIme?'tests/fixtures/electron-ime.cjs':'tests/fixtures/electron-smoke.cjs',origin,'0'],{cwd,env:environment,stdio:'inherit'})
 const [code]=await once(child,'exit')
 if(code!==0)throw new Error(`Electron smoke exited ${code}`)
 const stillRunning=await fetch(origin+'/jingle/api/state')
 if(!stillRunning.ok)throw new Error('Host became unavailable after quitting the overlay')
 if(!nativeIme){
  if(!output.includes('APPROVAL allowed-once')||!output.includes('smoke draft')||!output.includes('Approve \\"exact\\" plan'))throw new Error(`Smoke answer verification failed: ${output}`)
  console.log('HOST VERIFIED: structured multi-question batch and approval accepted')
 }
}finally{host.kill('SIGTERM');await once(host,'exit')}
