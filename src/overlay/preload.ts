/** Sandboxed preload: only fixed companion operations cross into the main process. */
// Electron is provided by the runtime; this package has no Electron dependency.
// @ts-expect-error Electron is intentionally a runtime-only import.
import { contextBridge, ipcRenderer } from 'electron'
contextBridge.exposeInMainWorld('jingleNotch', {
  onState: (callback: (state: unknown) => void) => ipcRenderer.on('jingle-notch:state', (_event: unknown, state: unknown) => callback(state)),
  onGeometry: (callback: (geometry: unknown) => void) => ipcRenderer.on('jingle-notch:geometry', (_event: unknown, geometry: unknown) => callback(geometry)),
  onAppearance: (callback: (appearance: unknown) => void) => ipcRenderer.on('jingle-notch:appearance', (_event: unknown, appearance: unknown) => callback(appearance)),
  onConnection: (callback: (connected: boolean) => void) => ipcRenderer.on('jingle-notch:connection', (_event: unknown, connected: boolean) => callback(connected)),
  submit: (action: unknown) => ipcRenderer.invoke('jingle-notch:submit', action),
  getPreferences: () => ipcRenderer.invoke('jingle-notch:preferences:get'),
  setPreferences: (preferences: unknown) => ipcRenderer.invoke('jingle-notch:preferences:set', preferences),
  quit: () => ipcRenderer.send('jingle-notch:quit'),
  expand: (expanded: boolean) => ipcRenderer.send('jingle-notch:expand', expanded === true),
  interact: () => ipcRenderer.send('jingle-notch:interact'),
  hold: (held: boolean) => ipcRenderer.send('jingle-notch:hold', held === true),
  editing: (value: boolean) => ipcRenderer.send('jingle-notch:editing', value === true),
  contentHeight: (height: number) => ipcRenderer.send('jingle-notch:height', height),
})
