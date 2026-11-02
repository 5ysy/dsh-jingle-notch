import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { compactWhaleState } from '../src/overlay/whale.ts'

describe('Jingle state routing', () => {
  it('starts animated idle when no sessions exist', () => {
    expect(compactWhaleState([], false)).toBe('idle')
  })

  it('surfaces requests before active work, regardless of selection order', () => {
    expect(compactWhaleState([{state:'working'}], true)).toBe('attention')
    expect(compactWhaleState([{state:'idle'}, {state:'attention'}], false)).toBe('attention')
  })

  it('shows an active session over an idle selection', () => {
    expect(compactWhaleState([{state:'idle'}, {state:'working'}], false)).toBe('working')
    expect(compactWhaleState([{state:'finished'}, {state:'thinking'}], false)).toBe('thinking')
    expect(compactWhaleState([{state:'working'}, {state:'error'}], false)).toBe('error')
    expect(compactWhaleState([{state:'idle'}, {state:'finished'}], false)).toBe('finished')
  })
})

describe('bundled animated whale artwork', () => {
  it.each(['working', 'layered'])('contains a genuine looping %s WebP with multiple different frames', async (name) => {
    const bytes = await readFile(new URL(`../assets/whale/${name}.webp`, import.meta.url))
    expect(bytes.toString('ascii', 0, 4)).toBe('RIFF')
    expect(bytes.toString('ascii', 8, 12)).toBe('WEBP')
    const frames: string[] = []
    let loop: number | undefined
    let duration = 0
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const type = bytes.toString('ascii', offset, offset + 4)
      const size = bytes.readUInt32LE(offset + 4)
      const start = offset + 8
      if (type === 'ANIM') loop = bytes.readUInt16LE(start + 4)
      if (type === 'ANMF') {
        duration += bytes.readUIntLE(start + 12, 3)
        frames.push(createHash('sha256').update(bytes.subarray(start + 16, start + size)).digest('hex'))
      }
      offset = start + size + (size % 2)
    }
    expect(loop).toBe(0)
    expect(frames.length).toBeGreaterThan(20)
    expect(new Set(frames).size).toBeGreaterThan(10)
    expect(duration).toBeGreaterThan(1000)
  })
})
