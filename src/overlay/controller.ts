import type { OverlayPreferences } from './preferences.ts'

/** Pure lifecycle; the native pointer poll supplies time, so timers cannot outlive a transition. */
export class IslandController {
  mode: 'hidden' | 'compact' | 'expanded' = 'compact'
  closeAt: number | null = null
  private hideAt: number | null = null
  private hovered = false
  private held = false
  private openedByHover = false
  private attentionKeys = new Set<string>()

  constructor(private preferences: OverlayPreferences, now = 0) { this.schedule(now) }

  configure(preferences: OverlayPreferences, now: number): void {
    this.preferences = preferences
    this.schedule(now)
  }

  hover(value: boolean, now: number): void {
    if (this.hovered === value) return
    this.hovered = value
    if (value && this.mode !== 'expanded') {
      if (this.preferences.openOnHover) this.open('hover', now)
      else this.mode = 'compact'
    }
    this.schedule(now)
  }

  open(reason: 'hover' | 'click' | 'attention', now: number): void {
    this.openedByHover = reason === 'hover'
    this.mode = 'expanded'
    this.schedule(now)
  }

  interact(now: number): void {
    this.openedByHover = false
    this.schedule(now)
  }

  hold(value: boolean, now: number): void {
    if (value === this.held) return
    this.held = value
    this.schedule(now)
  }

  collapse(now: number): void {
    this.mode = 'compact'
    this.openedByHover = false
    this.held = false
    this.schedule(now)
  }

  attention(keys: readonly string[], now: number): void {
    const fresh = keys.some(key => !this.attentionKeys.has(key))
    this.attentionKeys = new Set(keys)
    if (!fresh) return
    if (this.preferences.expandOnAttention) this.open('attention', now)
    else if (this.mode === 'hidden') { this.mode = 'compact'; this.schedule(now) }
  }

  tick(now: number): void {
    if (this.closeAt !== null && now >= this.closeAt) this.collapse(now)
    if (this.hideAt !== null && now >= this.hideAt) {
      this.mode = 'hidden'
      this.hideAt = null
    }
  }

  private schedule(now: number): void {
    this.closeAt = null
    this.hideAt = null
    if (this.held) return
    if (this.mode === 'expanded') {
      const delay = this.openedByHover ? 600 : this.preferences.autoCloseSeconds * 1000
      // Hover previews wait for the pointer to leave; clicked panels use the configured timer immediately.
      if (delay && (!this.hovered || !this.openedByHover)) this.closeAt = now + delay
    } else if (this.mode === 'compact' && this.preferences.hideAfterSeconds) {
      this.hideAt = now + this.preferences.hideAfterSeconds * 1000
    }
  }
}
