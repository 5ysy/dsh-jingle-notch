import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const WHALE_ASSETS = {
  layered: 'jingle-notch-whale://art/layered.webp',
  working: 'jingle-notch-whale://art/working.webp',
  layeredPoster: 'jingle-notch-whale://art/layered-poster.webp',
  workingPoster: 'jingle-notch-whale://art/working-poster.webp',
} as const

/** Exact URLs keep external input away from filesystem paths. */
export function createWhaleAssetHandler(directory: string, log: (message: string) => void) {
  const filenames = new Map(Object.values(WHALE_ASSETS).map(url => [url as string, url.slice(url.lastIndexOf('/') + 1)]))
  const cache = new Map<string, Promise<Buffer>>()
  return async (request: { url: string; method: string }): Promise<Response> => {
    const filename = filenames.get(request.url)
    if (!filename) return new Response(null, { status:404 })
    if (request.method !== 'GET') return new Response(null, { status:405, headers:{ Allow:'GET' } })
    try {
      let bytes = cache.get(filename)
      if (!bytes) { bytes = readFile(join(directory, filename)); cache.set(filename, bytes) }
      return new Response(new Uint8Array(await bytes), { headers:{
        'Content-Type':'image/webp', 'X-Content-Type-Options':'nosniff', 'Cache-Control':'public, max-age=86400',
      } })
    } catch (error) {
      cache.delete(filename)
      log(`whale artwork load failed (${filename}): ${String(error)}`)
      return new Response('Artwork unavailable', { status:500 })
    }
  }
}
