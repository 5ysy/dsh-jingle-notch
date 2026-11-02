// Run the production overlay through its launcher against a real isolated Harness Host.
const { app } = require('electron')
const assert = require('node:assert/strict')
const { writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')
const { setTimeout: pause } = require('node:timers/promises')

const entry = process.argv.splice(2, 1)[0]
const directory = process.env.JINGLE_NOTCH_TEST_OVERLAY_DIRECTORY
app.setPath('appData', directory)
app.setPath('userData', join(directory, 'electron'))
let verified = false
const deadline = setTimeout(() => { console.error('Host overlay timed out'); app.exit(1) }, 25_000)
app.once('browser-window-created', (_event, window) => {
  window.webContents.once('did-finish-load', async () => {
    try {
      assert.equal(process.env.ELECTRON_RUN_AS_NODE, undefined)
      const js = source => window.webContents.executeJavaScript(source, true)
      let loaded = false
      for (let i = 0; i < 100; i++) {
        loaded = await js("Boolean(document.querySelector('.session-chip[data-id=jingle-notch-host-compat]'))")
        if (loaded) break
        await pause(100)
      }
      assert.equal(loaded, true, 'Overlay did not receive real Host Session state')
      assert.equal(await js("typeof require + ':' + typeof process"), 'undefined:undefined')
      const preferences = window.webContents.getLastWebPreferences()
      assert.equal(preferences.sandbox, true)
      assert.equal(preferences.contextIsolation, true)
      assert.equal(preferences.nodeIntegration, false)
      verified = true
      void js("document.getElementById('quit-top').click()").catch(error => console.log(`Renderer released during quit: ${error.message}`))
    } catch (error) {
      console.error('Host overlay failed', error)
      clearTimeout(deadline)
      app.exit(1)
    }
  })
})
app.once('will-quit', () => {
  clearTimeout(deadline)
  writeFileSync(join(directory, 'result.json'), JSON.stringify({ ok: verified, exited: true }) + '\n')
})
import(pathToFileURL(entry).href).catch(error => { console.error(error); app.exit(1) })
