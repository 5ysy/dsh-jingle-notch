// Interactive native IME check; enter Pinyin with real macOS keys, then type "finish" on stdin.
const { app, screen } = require('electron')
const assert = require('node:assert/strict')
const { mkdtempSync } = require('node:fs')
const { writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { createInterface } = require('node:readline')
const directory = mkdtempSync(path.join(tmpdir(),'dsh-jingle-notch-ime-'))
app.setPath('appData',directory)
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms))
let attached=false,verified=false,window
const deadline=setTimeout(()=>{console.error('IME FAILED: native composition was not verified');app.exit(1)},300000)
app.on('browser-window-created',(_event,win)=>{
  if(attached)return
  attached=true;window=win
  let level
  const setLevel=win.setAlwaysOnTop.bind(win)
  win.setAlwaysOnTop=(flag,value,...rest)=>{level=value;return setLevel(flag,value,...rest)}
  win.webContents.once('did-finish-load',async()=>{
    try {
      const js=source=>win.webContents.executeJavaScript(source,true)
      for(let i=0;i<100;i++){if(await js("document.querySelectorAll('#cards textarea').length>0"))break;await pause(100)}
      assert.equal(level,'status','Production window should use the IME-compatible level')
      await js("document.querySelector('.session-chip[data-id=smoke]').click();document.getElementById('focus').click();window.jingleNotch.expand(true);window.__ime=document.querySelector('#cards textarea');window.__imeEvents=[];['compositionstart','compositionupdate','compositionend'].forEach(type=>window.__ime.addEventListener(type,event=>window.__imeEvents.push({type:event.type,data:event.data})));window.__ime.focus();window.__ime.scrollIntoView({block:'center'})")
      win.setTitle('dsh-jingle-notch IME verification')
      win.focus()
      await pause(100)
      assert.equal(level,'floating','Focusing the editor should lower it below native candidate windows')
      console.log('IME READY '+JSON.stringify({pid:process.pid,bounds:win.getBounds(),display:screen.getPrimaryDisplay().bounds}))
      let previous=''
      const polling=setInterval(async()=>{
        try {
          const state=await js("({text:window.__ime.value,events:window.__imeEvents,focused:document.activeElement===window.__ime})")
          const key=JSON.stringify(state)
          if(key!==previous){previous=key;console.log('IME STATE '+key)}
          if(!verified&&state.text.length>0&&state.events.some(event=>event.type==='compositionstart')){
            verified=true
            await writeFile('/tmp/dsh-jingle-notch-native-ime-committed.png',(await win.webContents.capturePage()).toPNG())
            console.log('IME VERIFIED: native marked composition text is visible and retained; choose a Chinese input source to see candidates, then enter finish to close')
          }
        }catch(error){clearInterval(polling);console.error('IME FAILED',error);app.exit(1)}
      },250)
      app.once('before-quit',()=>clearInterval(polling))
    }catch(error){console.error('IME FAILED',error);app.exit(1)}
  })
})
createInterface({input:process.stdin}).on('line',line=>{
  if(line==='high')window?.setAlwaysOnTop(true,'screen-saver')
  if(line==='normal')window?.setAlwaysOnTop(true,'status')
  if(line==='finish'){if(verified)app.quit();else{console.error('IME FAILED: no native composition observed');app.exit(1)}}
})
import(pathToFileURL(path.resolve(__dirname,'../../lib/overlay/main.js')).href).catch(error=>{console.error(error);app.exit(1)})
app.on('will-quit',()=>clearTimeout(deadline))
