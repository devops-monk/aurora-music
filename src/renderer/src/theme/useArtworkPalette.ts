import { useEffect, useState } from 'react'
import { artworkAt, CARD_ART_PX } from '@shared/models'
import { seedOf, toPalette, type ArtworkPalette, type Seed } from './palette'

const PALETTE_PX = 128
const SEED_CACHE_ENTRIES = 128
const seedCache = new Map<string, Seed>()

/** Draws [url] into a [size]² canvas and hands back its pixels. */
export function loadPixels(url: string, size: number): Promise<Uint8ClampedArray> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return reject(new Error('no 2d context'))
      // Square-crop the centre, like the sleeve itself is drawn.
      const side = Math.min(img.naturalWidth, img.naturalHeight)
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size)
      resolve(ctx.getImageData(0, 0, size, size).data)
    }
    img.onerror = () => reject(new Error('image failed'))
    img.src = url
  })
}

export async function artworkSeed(url: string): Promise<Seed | null> {
  const hit = seedCache.get(url)
  if (hit) return hit
  const pixels = await loadPixels(artworkAt(url, CARD_ART_PX) ?? url, PALETTE_PX)
  const seed = seedOf(pixels, PALETTE_PX, PALETTE_PX)
  if (seed) {
    if (seedCache.size >= SEED_CACHE_ENTRIES) seedCache.delete(seedCache.keys().next().value!)
    seedCache.set(url, seed)
  }
  return seed
}

/**
 * The page palette for [url]. A sleeve read once before is tinted on the very
 * first render, off the cache; a new one starts from the theme and the CSS
 * transition warms it in (260ms, or a cut with Reduce animation).
 */
export function useArtworkPalette(url: string | null | undefined, dark: boolean): ArtworkPalette | null {
  const [seed, setSeed] = useState<Seed | null>(() => (url ? (seedCache.get(url) ?? null) : null))
  useEffect(() => {
    if (!url) return setSeed(null)
    const cached = seedCache.get(url)
    if (cached) return setSeed(cached)
    let alive = true
    setSeed(null)
    artworkSeed(url)
      .then((s) => alive && setSeed(s))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [url])
  return seed ? toPalette(seed, dark) : null
}
