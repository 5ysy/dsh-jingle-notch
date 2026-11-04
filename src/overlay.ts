/**
 * Electron notch-overlay launcher: resolves an Electron binary (explicit
 * config path, then the plugin's local Electron install, then `npx`), spawns the bundled main
 * script pointed at the plugin's state URL, and tracks the child so the
 * overlay dies with the plugin. All failure modes are actionable messages —
 * the overlay is an optional surface and must never block the host.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** Result of one launch attempt, rendered by the command and dashboard surfaces. */
export interface OverlayLaunchResult {
  ok: boolean
  message: string
}

export interface OverlayLaunchOptions {
  /** Electron binary from config; empty falls through auto-resolution. */
  electronPath?: string
  /** Absolute origin serving `/jingle/api/state`, for example `http://127.0.0.1:3080`. */
  stateOrigin: string
  /** Pixels from the display's top edge; negative values move toward the bezel. */
  yOffset?: number
  log: (message: string) => void
}

/** The bundled Electron main script next to this module in `lib/`. */
export function overlayMainPath(): string {
  return fileURLToPath(new URL('./overlay/main.js', import.meta.url))
}

/**
 * Spawn the overlay if it is not already running. The caller (the companion
 * service) owns the returned child and kills it on disposal.
 */
export function launchOverlay(
  options: OverlayLaunchOptions,
  running: ChildProcess | undefined,
): { child: ChildProcess | undefined; result: OverlayLaunchResult } {
  if (!isHttpOrigin(options.stateOrigin)) {
    return { child: running, result: { ok: false, message: 'overlay: state origin must be an http(s) URL' } }
  }
  if (running !== undefined && running.exitCode === null && !running.killed) {
    return { child: running, result: { ok: true, message: 'overlay: already running' } }
  }
  const main = overlayMainPath()
  const resolved = resolveElectron(options.electronPath)
  if (resolved === undefined) {
    return {
      child: running,
      result: {
        ok: false,
        message: 'overlay: configured Electron path does not exist — set overlay.electronPath to a valid executable or clear it',
      },
    }
  }
  try {
    const environment = { ...process.env, DSH_JINGLE_NOTCH_ORIGIN: options.stateOrigin, DSH_JINGLE_NOTCH_PARENT_PID: String(process.pid) }
    delete (environment as Record<string, string | undefined>).ELECTRON_RUN_AS_NODE
    const child = spawn(resolved.command, [...resolved.args, main, options.stateOrigin, String(options.yOffset ?? 0)], {
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'ignore', 'pipe'],
      env: environment,
    })
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk: string) => options.log(`jingleNotch overlay: ${chunk.slice(0, 2048).trim()}`))
    child.once('exit', (code, signal) => { if (code !== 0 && signal !== 'SIGTERM') options.log(`jingleNotch overlay: exited code=${code}, signal=${signal ?? 'none'}`) })
    child.on('error', (error: unknown) => options.log(`jingleNotch overlay: ${String(error)}`))
    child.unref()
    return { child, result: { ok: true, message: `overlay: launched (${resolved.label})` } }
  } catch (error: unknown) {
    return { child: running, result: { ok: false, message: `overlay: launch failed: ${String(error)}` } }
  }
}

interface ResolvedElectron {
  command: string
  args: string[]
  label: string
}

function isHttpOrigin(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Electron binary resolution order: explicit config path, the local
 * `electron` install (its main export is the binary path), then `npx`, which
 * downloads on first use. A packaged Desktop executable is intentionally not
 * used here: it starts the already-installed Desktop application and cannot
 * evaluate an arbitrary overlay entrypoint.
 */
export function resolveElectron(configPath: string | undefined): ResolvedElectron | undefined {
  if (configPath !== undefined && configPath.length > 0) {
    if (existsSync(configPath)) return { command: configPath, args: [], label: 'configured path' }
    return undefined
  }
  try {
    const require = createRequire(import.meta.url)
    const binary = require('electron') as unknown
    if (typeof binary === 'string' && binary.length > 0) {
      return { command: binary, args: [], label: 'local electron' }
    }
  } catch {
    // No local install — fall through to npx.
  }
  return { command: 'npx', args: ['--yes', 'electron'], label: 'npx electron (downloads on first use)' }
}

/** Kill the POSIX process group as well as a possible npx wrapper. */
export function stopOverlay(child: ChildProcess, log: (message: string) => void): void {
  try {
    if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGTERM')
    else child.kill()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') log(`jingleNotch overlay: shutdown failed: ${String(error)}`)
  }
}
