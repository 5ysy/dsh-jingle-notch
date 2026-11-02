import { expect, it } from 'vitest'
import { islandGeometry } from '../src/overlay/geometry.ts'
const display = { bounds: { x: -1600, y: -900, width: 1600, height: 1000 }, workArea: { x: -1600, y: -862, width: 1600, height: 962 } }
it('reserves the measured notch with compact wings outside it', () => {
  expect(islandGeometry(display, { id:1, top:38, width:200 })).toEqual({ notch:200, top:38, compactWidth:310 })
})
it('uses a bounded menu-band fallback when native probing is unavailable', () => {
  expect(islandGeometry(display).notch).toBe(184)
  expect(islandGeometry(display, { id:1, top:0, width:184 }).notch).toBe(0)
})
