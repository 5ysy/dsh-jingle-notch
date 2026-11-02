export interface OverlaySize { width: number; height: number }
export interface OverlayGeometry { notch: number; top: number; compactWidth: number }

/** Native Pinyin candidates can use the Dock level (20), below the status level (25). */
export function overlayWindowLevel(mode: 'compact' | 'expanded' | 'hidden', editing: boolean): 'floating' | 'status' {
  return mode === 'expanded' && editing ? 'floating' : 'status'
}

/** Keep the resting notch strip narrow while allowing detail views to scroll. */
export function overlayWindowSize(mode: 'compact' | 'expanded' | 'hidden', geometry: OverlayGeometry, contentHeight: number): OverlaySize {
  if (mode === 'hidden') return { width: Math.max(90, geometry.notch), height: geometry.top }
  if (mode === 'compact') return { width: geometry.compactWidth, height: geometry.top }
  return { width: 615, height: Math.min(580, Math.max(geometry.top + 12, Math.ceil(contentHeight + geometry.top + 12))) }
}
