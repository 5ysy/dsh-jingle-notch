import { describe, expect, it } from 'vitest'
import { overlayWindowSize, overlayWindowLevel } from '../src/overlay/layout.ts'

describe('overlay window layout', () => {
  it('keeps the expanded editor below native IME candidates and restores notch priority otherwise', () => {
    expect(overlayWindowLevel('expanded',true)).toBe('floating')
    expect(overlayWindowLevel('expanded',false)).toBe('status')
    expect(overlayWindowLevel('compact',true)).toBe('status')
    expect(overlayWindowLevel('hidden',false)).toBe('status')
  })
  const geometry = { notch: 179, top: 32, compactWidth: 289 }

  it('keeps the collapsed strip shorter than the expanded session board', () => {
    expect(overlayWindowSize('compact', geometry, 170)).toEqual({ width: 289, height: 32 })
    expect(overlayWindowSize('expanded', geometry, 170)).toEqual({ width: 615, height: 214 })
  })

  it('caps an oversized detail view without changing compact geometry', () => {
    expect(overlayWindowSize('expanded', geometry, 1200)).toEqual({ width: 615, height: 580 })
    expect(overlayWindowSize('compact', geometry, 1200)).toEqual({ width: 289, height: 32 })
  })
})
