import { describe, expect, it } from 'vitest'
import { adaptedArtworkSaturation, hslToRgb, rgbToHsl, seedOf, toPalette } from './palette'

function image(fill: (x: number, y: number) => [number, number, number], size = 16) {
  const px = new Uint8ClampedArray(size * size * 4)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const [r, g, b] = fill(x, y)
      px.set([r, g, b, 255], (y * size + x) * 4)
    }
  return px
}

describe('palette', () => {
  it('round-trips HSL', () => {
    const [h, s, l] = rgbToHsl([200, 60, 90])
    expect(hslToRgb(h, s, l)).toEqual([200, 60, 90])
  })

  it('leaves greys grey and clamps colour into range', () => {
    expect(adaptedArtworkSaturation(0.05, 0.2, 0.6)).toBe(0.05)
    expect(adaptedArtworkSaturation(0.9, 0.2, 0.6)).toBe(0.6)
    expect(adaptedArtworkSaturation(0.13, 0.2, 0.6)).toBe(0.2)
  })

  it('finds the dominant colour and the vibrant accent', () => {
    // Mostly a near-grey slate, with a bright red patch: the page is slate, the accent red.
    const px = image((x, y) => (x < 6 && y < 6 ? [240, 20, 30] : [40, 42, 50]))
    const seed = seedOf(px, 16, 16)!
    expect(seed.dominant).toEqual([40, 42, 50])
    expect(seed.vibrant[0]).toBeGreaterThan(200)
  })

  it('derives a dark page tint that keeps its hue, with white text', () => {
    const seed = seedOf(image(() => [30, 60, 200]), 16, 16)!
    const p = toPalette(seed, true)
    expect(p.onBackground).toBe('#ffffff')
    const [r, g, b] = p.background.match(/\d+/g)!.map(Number)
    expect(b).toBeGreaterThan(r)
    expect(rgbToHsl([r, g, b])[2]).toBeCloseTo(0.13, 1)
  })

  it('derives a pale light-mode tint with black text', () => {
    const p = toPalette(seedOf(image(() => [30, 60, 200]), 16, 16)!, false)
    expect(p.onBackground).toBe('#000000')
    const rgb = p.background.match(/\d+/g)!.map(Number) as [number, number, number]
    expect(rgbToHsl(rgb)[2]).toBeCloseTo(0.91, 1)
  })
})
