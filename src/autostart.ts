/** Starts the native overlay with the enabled plugin and stops it on unload. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from './events.ts'
import type {} from './host-views.ts'

export const name = 'jingle-notch-autostart'
export const inject = ['jingleNotch', 'webServer']

export function apply(ctx: Context): void {
  const jingleNotch = ctx.jingleNotch
  if (!jingleNotch.configuration.overlay.enabled) return

  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const attempt = (left: number): void => {
    if (stopped) return
    try {
      const result = jingleNotch.startOverlay(ctx.webServer.getOrigin())
      ctx.logger.info(`jingle-notch: ${result.message}`)
    } catch (error: unknown) {
      if (left > 0) timer = setTimeout(() => attempt(left - 1), 500)
      else ctx.logger.warn(`jingle-notch: overlay auto-start gave up waiting for the webserver port: ${String(error)}`)
    }
  }
  attempt(60)
  ctx.effect(() => () => {
    stopped = true
    if (timer !== undefined) clearTimeout(timer)
    jingleNotch.stopOverlay()
  })
}
