import { describe, expect, it } from 'vitest'
import { DEFAULT_OVERLAY_PREFERENCES, normalizeOverlayPreferences, parseOverlayPreferences } from '../src/overlay/preferences.ts'

describe('overlay preferences', () => {
  it('defaults to hover expansion and a short automatic close delay', () => {
    expect(normalizeOverlayPreferences(undefined)).toEqual(DEFAULT_OVERLAY_PREFERENCES)
  })

  it('accepts only supported preference values', () => {
    expect(normalizeOverlayPreferences({ openOnHover: false, autoCloseSeconds: 30 })).toEqual({
      ...DEFAULT_OVERLAY_PREFERENCES,
      openOnHover: false,
      autoCloseSeconds: 30,
    })
    expect(normalizeOverlayPreferences({ openOnHover: 'yes', autoCloseSeconds: 999 })).toEqual(DEFAULT_OVERLAY_PREFERENCES)
  })

  it('repairs fields independently when stored data is partially invalid', () => {
    expect(normalizeOverlayPreferences({ openOnHover: false, autoCloseSeconds: '15' })).toEqual({
      ...DEFAULT_OVERLAY_PREFERENCES,
      openOnHover: false,
      autoCloseSeconds: DEFAULT_OVERLAY_PREFERENCES.autoCloseSeconds,
    })
  })

  it('supports disabling automatic close, idle hide and automatic alert expansion', () => {
    const value = { openOnHover:true, autoCloseSeconds:0, hideAfterSeconds:0, expandOnAttention:false }
    expect(parseOverlayPreferences(value)).toEqual(value)
  })

  it('rejects malformed IPC preferences without rewriting stored settings', () => {
    for (const value of [null, [], { ...DEFAULT_OVERLAY_PREFERENCES, autoCloseSeconds:NaN },
      { ...DEFAULT_OVERLAY_PREFERENCES, hideAfterSeconds:-1 }, { ...DEFAULT_OVERLAY_PREFERENCES, extra:true },
      { ...DEFAULT_OVERLAY_PREFERENCES, openOnHover:'false' }, { openOnHover:true }]) {
      expect(parseOverlayPreferences(value)).toBeUndefined()
    }
  })
})
