import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { createWhaleAssetHandler, WHALE_ASSETS } from '../src/overlay/whale-assets.ts'

const directory = fileURLToPath(new URL('../assets/whale/', import.meta.url))

describe('offline whale resource boundary', () => {
  it('serves only the four packaged WebP resources with the correct MIME type', async () => {
    const handler = createWhaleAssetHandler(directory, () => {})
    for (const url of Object.values(WHALE_ASSETS)) {
      const response = await handler({ url, method:'GET' })
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('image/webp')
      const bytes = Buffer.from(await response.arrayBuffer())
      expect(bytes.toString('ascii', 8, 12)).toBe('WEBP')
    }
  })

  it('rejects unrelated files, traversal, queries and write methods', async () => {
    const handler = createWhaleAssetHandler(directory, () => {})
    for (const url of ['file:///etc/passwd', 'jingle-notch-whale://art/../../package.json',
      'jingle-notch-whale://art/%2e%2e/working.webp', 'jingle-notch-whale://art/working.webp?file=secret',
      'jingle-notch-whale://evil/working.webp', 'jingle-notch-whale://art/unknown.webp']) {
      expect((await handler({url, method:'GET'})).status).toBe(404)
    }
    expect((await handler({ url:WHALE_ASSETS.working, method:'POST' })).status).toBe(405)
  })

  it('reports missing artwork without exposing filesystem details to the renderer', async () => {
    const messages: string[] = []
    const handler = createWhaleAssetHandler(joinMissing(), message => messages.push(message))
    const response = await handler({ url:WHALE_ASSETS.working, method:'GET' })
    expect(response.status).toBe(500)
    expect(messages.length).toBe(1)
    expect(messages[0]).toContain('working.webp')
    expect(await response.text()).not.toContain(directory)
  })
})

function joinMissing(): string { return `${directory}/missing` }
