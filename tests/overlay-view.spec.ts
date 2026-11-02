import { describe, expect, it } from 'vitest'
import { overlayHtml } from '../src/overlay/view.ts'

describe('overlay overview controls', () => {
  it('exposes a compact weekly recap entry beside the dsh home control', () => {
    const html = overlayHtml('test-nonce')
    expect(html).toContain('id="recap-open"')
    expect(html).toContain('id="recap-view"')
    expect(html).toContain('weekly-recap')
  })

  it('does not render the connected-session count in the overview heading', () => {
    const html = overlayHtml('test-nonce')
    expect(html).not.toContain("sessions.length+' connected'")
  })

  it('keeps the home board free of the redundant Sessions heading row', () => {
    const html = overlayHtml('test-nonce')
    expect(html).not.toContain('<section id="home-view"><div class="section-title"><strong>Sessions</strong>')
  })

  it('mounts animated whale artwork in both compact and focused views', () => {
    const html = overlayHtml('test-nonce')
    expect(html).toContain('id="mascot-avatar"')
    expect(html).toContain('id="focus-avatar"')
    expect(html).toContain('src="jingle-notch-whale://art/working.webp"')
    expect(html).toContain('src="jingle-notch-whale://art/layered.webp"')
    expect(html).toContain('function setWhaleState')
  })

  it('loads bundled images by fixed URL without embedding animation bytes in the page', () => {
    const html = overlayHtml('test-nonce')
    expect(html.includes('jingle-notch-whale://art/layered.webp')).toBe(true)
    expect(html.includes('jingle-notch-whale://art/working.webp')).toBe(true)
    expect(html.length).toBeLessThan(60000)
  })

  it('preserves the overview grid and focused card layout', () => {
    const html = overlayHtml('test-nonce')
    expect(html.includes('#overview{display:grid;grid-template-columns:1.15fr 1fr')).toBe(true)
    expect(html.includes('.focus-main{display:flex;gap:12px;align-items:center')).toBe(true)
    expect(html.includes('.focus-copy{min-width:0')).toBe(true)
  })

  it('shows a different animated whale on each compact wing', () => {
    const html = overlayHtml('test-nonce')
    expect(html).toContain('id="mascot-secondary"')
    expect(html).toContain('id="secondary-avatar"')
    expect(html).toContain("setWhaleState(document.getElementById('secondary-avatar')")
  })

  it('gives the layered artwork a larger visual scale in compact mode', () => {
    const html = overlayHtml('test-nonce')
    expect(html).toContain('.compact-whale .whale-layered .whale-raster{transform:scale(1.28)')
    expect(html).toContain('.compact-whale .whale-working .whale-raster{transform:scale(1.08)')
  })

  it('fills the focused card and session chips with the artwork', () => {
    const html = overlayHtml('test-nonce')
    expect(html).toContain('.focus-whale .whale-raster{transform:scale(1.22)')
    expect(html).toContain('.session-whale .whale-raster{transform:scale(1.35)')
  })

  it('limits the session viewport to two rows with internal scrolling', () => {
    const html = overlayHtml('test-nonce')
    expect(html).toContain('grid-auto-rows:35px')
    expect(html).toContain('max-height:77px;overflow-y:auto')
    expect(html).toContain('overscroll-behavior:contain')
    expect(html).toContain('--session-hue')
  })

  it('preserves native composition keys and defers request navigation while editing', () => {
    const html = overlayHtml('test-nonce')
    expect(html).toContain('e.isComposing||composing')
    expect(html).toContain("addEventListener('compositionstart'")
    expect(html).toContain('pendingTarget')
    expect(html).toContain('interactionBusy()')
  })
})
