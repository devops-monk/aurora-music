/**
 * The equaliser's layout and presets, from BitChord's `EqualizerCurve.kt`
 * (`EqLayout.MANUAL_BANDS_HZ`, Q 1.0, ±12 dB) and `EqualizerPreset.kt`.
 */

export const EQ_BANDS_HZ = [60, 150, 400, 1000, 2500, 6000, 14000] as const
export const EQ_Q = 1.0
export const EQ_RANGE_DB = 12

export const EQ_PRESETS: Record<string, number[]> = {
  Flat: [0, 0, 0, 0, 0, 0, 0],
  Acoustic: [3, 1.5, 0, 1.5, 2.5, 2, 1],
  'Bass Boost': [6, 4, 1.5, 0, 0, 0, 0],
  'Bass Cut': [-6, -4, -1.5, 0, 0, 0, 0],
  Vocal: [-3, -1.5, 1, 3.5, 3, 1, -1],
  'Treble Boost': [0, 0, 0, 0, 1.5, 3.5, 5],
  'Treble Cut': [0, 0, 0, 0, -1.5, -3.5, -5],
  Loudness: [6, 3.5, 0, -1.5, -1, 2, 5],
  'Spoken Word': [-5, -2.5, 1.5, 4, 3.5, 1.5, -2],
  Electronic: [5, 3, -1, 0, 1, 3, 4],
  Rock: [4, 2.5, -1, -1.5, 1, 3, 3.5],
  'Hip-Hop': [6, 4, 0.5, -1, 0.5, 2, 2.5],
  Jazz: [3, 1.5, 0, 1, 1.5, 2, 2.5],
  Classical: [3, 2, 0, 0, 1, 2.5, 3],
  'Small Speakers': [5, 4, 2, 0.5, 0, -1, -2],
  'Late Night': [3, 1, 0, 1.5, 1, -1, -3],
}

/** The preset these bands are, or "Custom" (`EqualizerPreset.matching`). */
export function presetMatching(bands: number[]): string {
  for (const [name, preset] of Object.entries(EQ_PRESETS)) {
    if (preset.every((db, i) => Math.abs(db - (bands[i] ?? 0)) < 0.05)) return name
  }
  return 'Custom'
}

/**
 * Headroom so boosted bands don't clip: pull the output down by the largest
 * combined boost. Neighbouring bands overlap, so two at +6 dB are worth more
 * than +6 dB between them; this estimate sums a band with half its neighbours.
 */
export function preampDb(bands: number[]): number {
  let peak = 0
  bands.forEach((db, i) => {
    const combined = db + 0.5 * Math.max(0, bands[i - 1] ?? 0) + 0.5 * Math.max(0, bands[i + 1] ?? 0)
    peak = Math.max(peak, combined)
  })
  return -Math.min(EQ_RANGE_DB, peak)
}

export const dbToGain = (db: number) => Math.pow(10, db / 20)
