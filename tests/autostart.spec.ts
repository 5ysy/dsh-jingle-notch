import { expect, it, vi } from 'vitest'
import { apply } from '../src/autostart.ts'

it('starts the overlay when the enabled plugin receives a webserver', () => {
  const startOverlay = vi.fn(() => ({ ok: true, message: 'overlay: launched' }))
  const stopOverlay = vi.fn(() => ({ ok: true, message: 'overlay: stopping' }))
  let dispose!: () => void
  const effect = vi.fn((factory: () => () => void) => { dispose = factory() })
  apply({
    jingleNotch: { configuration: { overlay: { enabled: true, autoStart: false } }, startOverlay, stopOverlay },
    webServer: { getOrigin: () => 'http://127.0.0.1:3080' },
    effect,
    logger: { info: vi.fn(), warn: vi.fn() },
  } as never)
  expect(startOverlay).toHaveBeenCalledWith('http://127.0.0.1:3080')
  dispose()
  expect(stopOverlay).toHaveBeenCalledOnce()
})

it('does not launch when the overlay is disabled in plugin configuration', () => {
  const startOverlay = vi.fn()
  apply({
    jingleNotch: { configuration: { overlay: { enabled: false, autoStart: false } }, startOverlay, stopOverlay: vi.fn() },
    webServer: { getOrigin: () => 'http://127.0.0.1:3080' },
    effect: vi.fn(),
    logger: { info: vi.fn(), warn: vi.fn() },
  } as never)
  expect(startOverlay).not.toHaveBeenCalled()
})
