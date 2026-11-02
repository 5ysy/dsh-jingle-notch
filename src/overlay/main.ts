/** Native window and host transport. The sandboxed renderer receives only fixed IPC capabilities. */
import { createRequire } from 'node:module'
import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { islandGeometry, screenProbe, type NotchMeasurement } from './geometry.ts'
import { overlayWindowSize, overlayWindowLevel } from './layout.ts'
import { DEFAULT_OVERLAY_PREFERENCES, normalizeOverlayPreferences, parseOverlayPreferences, type OverlayPreferences } from './preferences.ts'
import { IslandController } from './controller.ts'
import { overlayHtml } from './view.ts'
import { createWhaleAssetHandler } from './whale-assets.ts'
import { actionableOverlayRequests } from './presentation.ts'

// Electron is supplied by the launcher, independently of the host's dependencies.
const { app, BrowserWindow, ipcMain, screen, protocol } = createRequire(import.meta.url)('electron')
protocol.registerSchemesAsPrivileged([{ scheme:'jingle-notch-whale', privileges:{ standard:true, secure:true } }])
// Stable identity keeps preferences independent of the host's checkout and Electron version.
app.setName('JingleNotch')
// Preferences belong to this application identity.
app.setPath('userData', join(app.getPath('appData'), 'dsh-jingle-notch'))
const stateOrigin = process.argv[2]
const offset = Number(process.argv[3] ?? 0)
try {
  const url = new URL(stateOrigin)
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== stateOrigin) throw new Error('expected http(s) origin')
} catch (error) {
  process.stderr.write(`jingleNotch overlay: invalid state origin: ${String(error)}\n`)
  process.exit(2)
}
let win: InstanceType<typeof BrowserWindow> | undefined
let measurements: NotchMeasurement[] = []
let timer: ReturnType<typeof setInterval> | undefined
let pointerTimer: ReturnType<typeof setInterval> | undefined
let displayTimer: ReturnType<typeof setTimeout> | undefined
let polling = false
let unavailable = false
let stopping = false
let preferences: OverlayPreferences = { ...DEFAULT_OVERLAY_PREFERENCES }
let preferencesPath = ''
let controller = new IslandController(preferences, Date.now())
let contentHeight = 170
let lastMode = ''
let lastAppearance = ''
let ignoringMouse: boolean | undefined
let hovered = false
let editing = false
let windowLevel = 'status'
let preferenceWrites: Promise<unknown> = Promise.resolve()

function log(message: string): void { process.stderr.write(`jingleNotch overlay: ${message}\n`) }
function send(channel: string, ...args: unknown[]): void {
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return
  try { win.webContents.send(channel, ...args) } catch (error) { log(`renderer message failed (${channel}): ${String(error)}`) }
}
async function measure(): Promise<void> {
  if (process.platform !== 'darwin') return
  await new Promise<void>(resolve => {
    execFile('/usr/bin/swift', ['-e', screenProbe], { timeout: 15000, maxBuffer: 64 * 1024 }, (error, stdout) => {
      if (error) log(`native screen measurement unavailable; using menu geometry: ${error.message}`)
      else {
        try {
          const parsed: unknown = JSON.parse(stdout)
          if (!Array.isArray(parsed)) throw new Error('screen probe returned no display list')
          measurements = parsed.filter((v): v is NotchMeasurement => typeof v === 'object' && v !== null
            && Number.isFinite(v.id) && Number.isFinite(v.top) && v.top >= 0 && Number.isFinite(v.width) && v.width >= 0)
        } catch (error) { log(`invalid screen geometry: ${String(error)}`) }
      }
      resolve()
    })
  })
}
function position(): void {
  if (!win || win.isDestroyed()) return
  const display = screen.getPrimaryDisplay()
  const geometry = islandGeometry(display, measurements.find(m => m.id === display.id))
  const size = overlayWindowSize(controller.mode, geometry, contentHeight)
  const width = Math.round(Math.min(size.width, display.bounds.width))
  const height = Math.round(Math.min(size.height, display.bounds.height - 10))
  win.setBounds({ x: display.bounds.x + Math.round((display.bounds.width - width) / 2),
    y: (process.platform === 'darwin' ? display.bounds.y : display.workArea.y) + (Number.isFinite(offset) ? offset : 0), width, height }, false)
  send('jingle-notch:geometry', geometry)
}
function syncWindow(force = false): void {
  if (!win || win.isDestroyed()) return
  const level = overlayWindowLevel(controller.mode, editing)
  if (level !== windowLevel) { windowLevel = level; win.setAlwaysOnTop(true, level) }
  if (controller.mode !== lastMode || force) {
    lastMode = controller.mode
    position()
  }
  const appearance = { mode:controller.mode, closeAt:controller.closeAt, hovered }
  const key = JSON.stringify(appearance)
  if (key !== lastAppearance || force) {
    lastAppearance = key
    send('jingle-notch:appearance', appearance)
  }
}
function pointerTick(): void {
  if (!win || win.isDestroyed()) return
  const now = Date.now(), pointer = screen.getCursorScreenPoint(), bounds = win.getBounds()
  const display = screen.getPrimaryDisplay()
  const geometry = islandGeometry(display, measurements.find(m => m.id === display.id))
  const width = controller.mode === 'hidden' ? Math.max(90, geometry.notch) : bounds.width
  const inset = (bounds.width - width) / 2
  const height = controller.mode === 'expanded' ? bounds.height - 12 : geometry.top
  const x = pointer.x - bounds.x - inset, y = pointer.y - bounds.y
  hovered = x >= 0 && x < width && y >= 0 && y < height
  // Rounded bottom corners and the shadow are transparent and must not intercept other apps.
  if (hovered && y > height - 20 && (x < 20 || x > width - 20)) {
    const dx = x < 20 ? x - 20 : x - (width - 20)
    hovered = dx * dx + (y - (height - 20)) ** 2 <= 400
  }
  controller.hover(hovered, now)
  controller.tick(now)
  if (ignoringMouse !== !hovered) {
    ignoringMouse = !hovered
    win.setIgnoreMouseEvents(ignoringMouse, { forward:true })
  }
  syncWindow()
}
function createWindow(): void {
  win = new BrowserWindow({ width:334, height:38, frame:false, transparent:true, resizable:false, movable:false,
    skipTaskbar:true, hasShadow:false, show:false, fullscreenable:false, minimizable:false, maximizable:false,
    ...(process.platform === 'darwin' ? { type:'panel', roundedCorners:false } : {}),
    webPreferences: { preload:fileURLToPath(new URL('./preload.cjs', import.meta.url)), nodeIntegration:false,
      contextIsolation:true, sandbox:true, webSecurity:true, backgroundThrottling:false, spellcheck:false },
  })
  // Text editing temporarily lowers this further so native IME candidates remain visible.
  win.setAlwaysOnTop(true, 'status')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen:true })
  win.webContents.setWindowOpenHandler(() => ({ action:'deny' }))
  win.webContents.on('will-navigate', (event: { preventDefault(): void }) => event.preventDefault())
  win.webContents.on('did-finish-load', () => { syncWindow(true); win?.showInactive(); void poll() })
  win.webContents.on('render-process-gone', (_event: unknown, details: { reason: string }) => { log(`renderer exited: ${details.reason}`); app.quit() })
  void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(overlayHtml(randomBytes(18).toString('base64')))}`)
    .catch((error: unknown) => { log(`window load failed: ${String(error)}`); app.quit() })
}
async function poll(): Promise<void> {
  if (polling || stopping) return
  polling = true
  try {
    const response = await fetch(`${stateOrigin}/jingle/api/state`, { signal:AbortSignal.timeout(4000) })
    if (!response.ok) throw new Error(`state endpoint HTTP ${response.status}`)
    const payload: unknown = await response.json()
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new Error('invalid host state')
    const state = payload as Record<string, unknown>
    if (unavailable) log('host connection restored')
    unavailable = false
    const pending = actionableOverlayRequests(state).map(request => request.key)
    controller.attention(pending, Date.now())
    syncWindow()
    send('jingle-notch:state', state)
    send('jingle-notch:connection', true)
  } catch (error) {
    if (!unavailable) log(`host unavailable: ${String(error)}`)
    unavailable = true
    send('jingle-notch:connection', false)
  } finally { polling = false }
}
ipcMain.on('jingle-notch:quit', (event: { sender: unknown }) => {
  if (event.sender === win?.webContents) app.quit()
})
ipcMain.on('jingle-notch:expand', (event: { sender: unknown }, value: unknown) => {
  if (event.sender !== win?.webContents || typeof value !== 'boolean') return
  if (value) controller.open('click', Date.now())
  else controller.collapse(Date.now())
  syncWindow()
})
ipcMain.on('jingle-notch:interact', (event: { sender:unknown }) => {
  if (event.sender !== win?.webContents) return
  controller.interact(Date.now()); syncWindow()
})
ipcMain.on('jingle-notch:hold', (event: { sender:unknown }, value:unknown) => {
  if (event.sender !== win?.webContents || typeof value !== 'boolean') return
  controller.hold(value, Date.now()); syncWindow()
})
ipcMain.on('jingle-notch:editing', (event: { sender:unknown }, value:unknown) => {
  if (event.sender !== win?.webContents || typeof value !== 'boolean') return
  editing = value
  syncWindow()
})
ipcMain.on('jingle-notch:height', (event: { sender:unknown }, value:unknown) => {
  if (event.sender !== win?.webContents || typeof value !== 'number' || !Number.isFinite(value)) return
  const height = Math.max(140, Math.min(1600, Math.ceil(value)))
  if (height === contentHeight) return
  contentHeight = height
  if (controller.mode === 'expanded') position()
})
ipcMain.handle('jingle-notch:preferences:get', (event: { sender: unknown }) => {
  if (event.sender !== win?.webContents) return { ...DEFAULT_OVERLAY_PREFERENCES }
  return { ...preferences }
})
ipcMain.handle('jingle-notch:preferences:set', (event: { sender: unknown }, value: unknown) => {
  if (event.sender !== win?.webContents) return { ok:false, error:'Invalid sender' }
  const next = parseOverlayPreferences(value)
  if (!next) return { ok:false, error:'Invalid overlay preferences' }
  const save = async () => {
    const temporaryPath = `${preferencesPath}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`
    try {
      await mkdir(app.getPath('userData'), { recursive:true })
      await writeFile(temporaryPath, `${JSON.stringify(next)}\n`, { encoding:'utf8', mode:0o600, flag:'wx' })
      await rename(temporaryPath, preferencesPath)
      preferences = next
      controller.configure(preferences, Date.now()); syncWindow()
      return { ok:true, preferences:{ ...preferences } }
    } catch (error) {
      log(`preferences save failed: ${String(error)}`)
      try { await unlink(temporaryPath) } catch (cleanupError) {
        if ((cleanupError as NodeJS.ErrnoException).code !== 'ENOENT') log(`preferences cleanup failed: ${String(cleanupError)}`)
      }
      return { ok:false, error:'Could not save overlay preferences' }
    }
  }
  // Serialize saves so rapid control changes cannot race renames or overwrite newer choices.
  preferenceWrites = preferenceWrites.then(save, save)
  return preferenceWrites
})
ipcMain.handle('jingle-notch:submit', async (event: { sender: unknown }, action: unknown) => {
  if (event.sender !== win?.webContents || typeof action !== 'object' || action === null) return { ok:false, error:'Invalid sender' }
  const a = action as Record<string, unknown>
  let path: string, body: unknown
  if (a.kind === 'approval' && typeof a.id === 'string' && ['always','allowed-once','rejected'].includes(String(a.decision))) {
    path = `/jingle/api/approvals/${encodeURIComponent(a.id)}`; body = { decision:a.decision }
  } else if (a.kind === 'question' && typeof a.sessionId === 'string' && typeof a.callId === 'string' && Array.isArray(a.answers)) {
    path = `/jingle/api/questions/${encodeURIComponent(a.sessionId)}/${encodeURIComponent(a.callId)}`; body = { answers:a.answers }
  } else return { ok:false, error:'Invalid companion action' }
  try {
    const response = await fetch(`${stateOrigin}${path}`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body), signal:AbortSignal.timeout(4000) })
    const result = await response.json() as { error?: string; ok?: boolean }
    if (!response.ok) return { ok:false, error:result.error ?? `HTTP ${response.status}` }
    void poll()
    return result
  } catch (error) { log(`submit failed: ${String(error)}`); return { ok:false, error:String(error) } }
})
app.whenReady().then(async () => {
  preferencesPath = join(app.getPath('userData'), 'overlay-preferences.json')
  try {
    if ((await stat(preferencesPath)).size > 4096) throw new Error('preferences exceed 4 KiB')
    const saved = JSON.parse(await readFile(preferencesPath, 'utf8')) as unknown
    preferences = normalizeOverlayPreferences(saved)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') log(`preferences load failed: ${String(error)}`)
  }
  controller = new IslandController(preferences, Date.now())
  app.dock?.hide()
  protocol.handle('jingle-notch-whale', createWhaleAssetHandler(fileURLToPath(new URL('../../assets/whale/', import.meta.url)), log))
  createWindow()
  pointerTimer = setInterval(pointerTick, 50)
  const parent = Number(process.env.DSH_JINGLE_NOTCH_PARENT_PID)
  timer = setInterval(() => {
    if (Number.isSafeInteger(parent) && parent > 0) {
      try { process.kill(parent, 0) } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') { app.quit(); return } }
    }
    void poll()
  }, 1000)
  await measure(); position()
  const changed = (): void => { position(); clearTimeout(displayTimer); displayTimer = setTimeout(() => void measure().then(position), 300) }
  screen.on('display-added', changed); screen.on('display-removed', changed); screen.on('display-metrics-changed', changed)
}).catch((error: unknown) => { log(`startup failed: ${String(error)}`); app.quit() })
app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => {
  stopping = true
  if (timer) clearInterval(timer)
  if (pointerTimer) clearInterval(pointerTimer)
  if (displayTimer) clearTimeout(displayTimer)
})
process.on('SIGTERM', () => app.quit())
