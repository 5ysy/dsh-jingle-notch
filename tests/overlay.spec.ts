import { describe, expect, it } from 'vitest'
import { launchOverlay, overlayMainPath, resolveElectron } from '../src/overlay.ts'

describe('overlay launcher', () => {
  it('rejects a non-http state origin before resolving an executable', () => {
    const result = launchOverlay({ stateOrigin: 'javascript:alert(1)', log: () => {} }, undefined)
    expect(result.result.ok).toBe(false)
    expect(result.result.message).toContain('http(s)')
    expect(result.child).toBeUndefined()
  })

  it('reports a missing explicit Electron path', () => {
    expect(resolveElectron('/definitely/missing/electron')).toBeUndefined()
  })

  it('points at the bundled main artifact location', () => {
    expect(overlayMainPath()).toMatch(/overlay[\\/]main\.js$/u)
  })
})
