/**
 * The colours an album, playlist or artist page paints itself in, ported from
 * BitChord's `ui/theme/ArtworkPalette.kt`.
 *
 * Same seed (dominant swatch, most vibrant swatch, bottom-edge average) and the
 * same HSL rules per theme. Android's `Palette` is swapped for a small
 * histogram quantiser over a 128px sample, which lands on the same swatches for
 * the purpose: "what is this sleeve mostly, and what is its loudest colour".
 */

export interface ArtworkPalette {
  background: string
  wash: string
  elevated: string
  accent: string
  onBackground: string
  onBackgroundVariant: string
  divider: string
}

export interface Seed {
  dominant: [number, number, number]
  vibrant: [number, number, number]
  edge: [number, number, number]
  topBandLuminance: number
}

type Rgb = [number, number, number]

const SWATCH_COUNT = 24
const EDGE_BAND = 0.18
const TOP_BAND = 0.1
const CHROMATIC_SATURATION_THRESHOLD = 0.12

export function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h *= 60
  return [h, s, l]
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const css = ([r, g, b]: Rgb) => `rgb(${r}, ${g}, ${b})`

export function relativeLuminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function adaptedArtworkSaturation(source: number, minimum: number, maximum: number): number {
  const s = clamp(source, 0, 1)
  return s < CHROMATIC_SATURATION_THRESHOLD ? s : clamp(s, minimum, maximum)
}

function withHsl(rgb: Rgb, sat: (s: number) => number, light: (l: number) => number): Rgb {
  const [h, s, l] = rgbToHsl(rgb)
  return hslToRgb(h, clamp(sat(s), 0, 1), clamp(light(l), 0, 1))
}

interface Swatch {
  rgb: Rgb
  population: number
}

/** 5-bit-per-channel histogram, averaged within each bucket; the most populated buckets are the swatches. */
function swatchesOf(pixels: Uint8ClampedArray, filter: boolean): Swatch[] {
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>()
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    if (filter) {
      // Palette's default filter: drop near-black and near-white, which are never accents.
      const [, , l] = rgbToHsl([r, g, b])
      if (l <= 0.05 || l >= 0.95) continue
    }
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.r += r
      bucket.g += g
      bucket.b += b
      bucket.n++
    } else buckets.set(key, { r, g, b, n: 1 })
  }
  return [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, SWATCH_COUNT)
    .map((x) => ({ rgb: [Math.round(x.r / x.n), Math.round(x.g / x.n), Math.round(x.b / x.n)] as Rgb, population: x.n }))
}

function averageRows(pixels: Uint8ClampedArray, width: number, fromRow: number, toRow: number): Rgb {
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let y = fromRow; y < toRow; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      r += pixels[i]
      g += pixels[i + 1]
      b += pixels[i + 2]
      n++
    }
  }
  n = Math.max(1, n)
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
}

export function seedOf(pixels: Uint8ClampedArray, width: number, height: number): Seed | null {
  const all = swatchesOf(pixels, false)
  if (!all.length) return null
  const candidates = swatchesOf(pixels, true)
  const pool = candidates.length ? candidates : all
  const dominant = all.reduce((a, b) => (b.population > a.population ? b : a))
  // Saturation against the square root of population: a colour nobody sees
  // enough of reads as arbitrary, and a grey one isn't an accent at all.
  const vibrant = pool.reduce((a, b) =>
    rgbToHsl(b.rgb)[1] * Math.sqrt(b.population) > rgbToHsl(a.rgb)[1] * Math.sqrt(a.population) ? b : a,
  )
  const edgeRows = clamp(Math.floor(height * EDGE_BAND), 1, height)
  const topRows = clamp(Math.floor(height * TOP_BAND), 1, height)
  let lum = 0
  for (let y = 0; y < topRows; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      lum += relativeLuminance([pixels[i], pixels[i + 1], pixels[i + 2]])
    }
  return {
    dominant: dominant.rgb,
    vibrant: vibrant.rgb,
    edge: averageRows(pixels, width, height - edgeRows, height),
    topBandLuminance: lum / Math.max(1, topRows * width),
  }
}

export function toPalette(seed: Seed, dark: boolean): ArtworkPalette {
  const { dominant, vibrant, edge } = seed
  if (dark) {
    return {
      background: css(withHsl(dominant, (s) => adaptedArtworkSaturation(s, 0.2, 0.62), () => 0.13)),
      wash: css(withHsl(edge, (s) => adaptedArtworkSaturation(s, 0.18, 0.58), (l) => clamp(l, 0.14, 0.24))),
      elevated: css(withHsl(dominant, (s) => adaptedArtworkSaturation(s, 0.2, 0.62), () => 0.22)),
      accent: css(withHsl(vibrant, (s) => adaptedArtworkSaturation(s, 0.55, 1), (l) => clamp(l, 0.62, 0.78))),
      onBackground: '#ffffff',
      onBackgroundVariant: 'rgba(255, 255, 255, 0.8)',
      divider: 'rgba(255, 255, 255, 0.12)',
    }
  }
  return {
    background: css(withHsl(dominant, (s) => adaptedArtworkSaturation(s, 0.14, 0.5), () => 0.91)),
    wash: css(withHsl(edge, (s) => adaptedArtworkSaturation(s, 0.12, 0.46), (l) => clamp(l, 0.78, 0.9))),
    elevated: css(withHsl(dominant, (s) => adaptedArtworkSaturation(s, 0.14, 0.5), () => 0.83)),
    accent: css(withHsl(vibrant, (s) => adaptedArtworkSaturation(s, 0.55, 1), (l) => clamp(l, 0.3, 0.44))),
    onBackground: '#000000',
    onBackgroundVariant: 'rgba(0, 0, 0, 0.7)',
    divider: 'rgba(0, 0, 0, 0.1)',
  }
}
