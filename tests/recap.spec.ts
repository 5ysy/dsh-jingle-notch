import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { RecapStore } from '../src/recap.ts'
const paths: string[]=[]
afterEach(async()=>{for(const p of paths.splice(0))await rm(p,{recursive:true,force:true})})
async function setup(){const dir=await mkdtemp(join(tmpdir(),'jingleNotch-recap-'));paths.push(dir);return dir}
it('persists only aggregates and restores them across plugin restarts', async()=>{
 const dir=await setup(), now=Date.UTC(2026,9,23)
 const store=new RecapStore(dir,()=>{},()=>now);await store.ready
 store.record('private-session-id',{turns:1},now)
 store.record('private-session-id',{toolCalls:2},now+1000)
 await store.close()
 const raw=await readFile(join(dir,'recap.json'),'utf8')
 expect(raw).not.toContain('private-session-id')
 const next=new RecapStore(dir,()=>{},()=>now);await next.ready
 expect(next.snapshot().weeks[0]).toMatchObject({turns:1,toolCalls:2,activeMs:1000})
 await next.close()
})
it('retains twelve weeks and rejects corrupted or non-aggregate input',async()=>{
 const dir=await setup(), now=Date.UTC(2026,9,23), logs:string[]=[]
 await writeFile(join(dir,'recap.json'),JSON.stringify({version:1,weeks:[{week:'bad',turns:-1,prompt:'secret'}]}))
 const store=new RecapStore(dir,m=>logs.push(m),()=>now);await store.ready
 expect(logs).toHaveLength(1)
 for(let i=0;i<20;i++)store.record('s',{turns:1},now-i*7*86400000)
 expect(store.snapshot().weeks).toHaveLength(12)
 await store.close()
})
