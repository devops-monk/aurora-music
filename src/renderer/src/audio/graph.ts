import { EQ_BANDS_HZ, EQ_Q, dbToGain, preampDb } from './eq'

/**
 * The Web Audio graph both <audio> elements play through:
 *
 *   element ─ source ─ trackGain ─┐
 *   element ─ source ─ trackGain ─┴─ 7 × biquad (EQ) ─ preamp ─ master ─ out
 *
 * `trackGain` carries each track's own loudness normalisation and its fade, so
 * two tracks can overlap in a crossfade at their own levels; the EQ and master
 * volume are shared. Built lazily on the first play, because an AudioContext
 * made before any user gesture starts suspended.
 */

export class AudioGraph {
  readonly ctx = new AudioContext({ latencyHint: 'playback' })
  readonly trackGains: GainNode[]
  readonly filters: BiquadFilterNode[]
  readonly preamp: GainNode
  readonly master: GainNode

  constructor(elements: HTMLMediaElement[]) {
    const ctx = this.ctx
    this.filters = EQ_BANDS_HZ.map((hz, i) => {
      const f = ctx.createBiquadFilter()
      f.type = i === 0 ? 'lowshelf' : i === EQ_BANDS_HZ.length - 1 ? 'highshelf' : 'peaking'
      f.frequency.value = hz
      f.Q.value = EQ_Q
      f.gain.value = 0
      return f
    })
    this.preamp = ctx.createGain()
    this.master = ctx.createGain()
    this.filters.reduce<AudioNode>((prev, f) => (prev.connect(f), f), this.preamp)
    // preamp → filters… → master → destination
    this.filters[this.filters.length - 1].connect(this.master)
    this.master.connect(ctx.destination)
    this.trackGains = elements.map((el) => {
      const source = ctx.createMediaElementSource(el)
      const gain = ctx.createGain()
      source.connect(gain).connect(this.preamp)
      return gain
    })
  }

  resume() {
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined)
  }

  setEq(enabled: boolean, bands: number[]) {
    const t = this.ctx.currentTime
    this.filters.forEach((f, i) => f.gain.setTargetAtTime(enabled ? (bands[i] ?? 0) : 0, t, 0.03))
    this.preamp.gain.setTargetAtTime(enabled ? dbToGain(preampDb(bands)) : 1, t, 0.03)
  }

  setMaster(gain: number) {
    this.master.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.02)
  }

  /** Sets a track's level now, cancelling any fade in progress. */
  setTrack(index: number, gain: number) {
    const g = this.trackGains[index].gain
    g.cancelScheduledValues(this.ctx.currentTime)
    g.setTargetAtTime(gain, this.ctx.currentTime, 0.02)
  }

  /** Ramps a track from [from] to [to] over [seconds], on an equal-power-ish curve. */
  fade(index: number, from: number, to: number, seconds: number) {
    const g = this.trackGains[index].gain
    const t = this.ctx.currentTime
    g.cancelScheduledValues(t)
    const steps = 32
    const curve = new Float32Array(steps)
    for (let i = 0; i < steps; i++) {
      const x = i / (steps - 1)
      // sin/cos fades keep the summed power steady through the overlap.
      const shape = to > from ? Math.sin((x * Math.PI) / 2) : Math.cos((x * Math.PI) / 2)
      curve[i] = to > from ? from + (to - from) * shape : to + (from - to) * shape
    }
    g.setValueCurveAtTime(curve, t, Math.max(0.05, seconds))
  }

  /** The EQ's combined response at [freqs], in dB, for drawing the curve. */
  response(freqs: Float32Array<ArrayBuffer>): Float32Array {
    const total = new Float32Array(freqs.length)
    const mag = new Float32Array(freqs.length)
    const phase = new Float32Array(freqs.length)
    for (const f of this.filters) {
      f.getFrequencyResponse(freqs, mag, phase)
      for (let i = 0; i < freqs.length; i++) total[i] += 20 * Math.log10(mag[i])
    }
    return total
  }
}
