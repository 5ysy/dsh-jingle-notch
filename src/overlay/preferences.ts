export interface OverlayPreferences {
  openOnHover: boolean
  autoCloseSeconds: 0 | 5 | 10 | 15 | 30 | 60
  hideAfterSeconds: 0 | 60 | 180 | 300
  expandOnAttention: boolean
}

export const DEFAULT_OVERLAY_PREFERENCES: OverlayPreferences = {
  openOnHover: true,
  autoCloseSeconds: 15,
  hideAfterSeconds: 180,
  expandOnAttention: true,
}

const AUTO_CLOSE_OPTIONS = new Set<number>([0, 5, 10, 15, 30, 60])
const HIDE_OPTIONS = new Set<number>([0, 60, 180, 300])

export function normalizeOverlayPreferences(value: unknown): OverlayPreferences {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { ...DEFAULT_OVERLAY_PREFERENCES }
  const input = value as Record<string, unknown>
  return {
    openOnHover: typeof input.openOnHover === 'boolean' ? input.openOnHover : DEFAULT_OVERLAY_PREFERENCES.openOnHover,
    autoCloseSeconds: typeof input.autoCloseSeconds === 'number' && AUTO_CLOSE_OPTIONS.has(input.autoCloseSeconds)
      ? input.autoCloseSeconds as OverlayPreferences['autoCloseSeconds']
      : DEFAULT_OVERLAY_PREFERENCES.autoCloseSeconds,
    hideAfterSeconds: typeof input.hideAfterSeconds === 'number' && HIDE_OPTIONS.has(input.hideAfterSeconds)
      ? input.hideAfterSeconds as OverlayPreferences['hideAfterSeconds'] : DEFAULT_OVERLAY_PREFERENCES.hideAfterSeconds,
    expandOnAttention: typeof input.expandOnAttention === 'boolean' ? input.expandOnAttention : DEFAULT_OVERLAY_PREFERENCES.expandOnAttention,
  }
}

/** IPC mutations require every known field and reject unknown fields and invalid values. */
export function parseOverlayPreferences(value: unknown): OverlayPreferences | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const input = value as Record<string, unknown>
  const normalized = normalizeOverlayPreferences(value)
  const keys = Object.keys(normalized) as (keyof OverlayPreferences)[]
  if (Object.keys(input).length !== keys.length || keys.some(key => input[key] !== normalized[key])) return undefined
  return normalized
}
