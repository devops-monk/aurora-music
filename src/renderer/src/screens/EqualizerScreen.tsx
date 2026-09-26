import { useEffect, useMemo, useRef } from 'react'
import { PageScroll } from '../components/PageScroll'
import { useSettings } from '../store/settings'
import { EQ_BANDS_HZ, EQ_PRESETS, EQ_Q, EQ_RANGE_DB, presetMatching } from '../audio/eq'

const LABELS = ['60', '150', '400', '1K', '2.5K', '6K', '14K']
const CURVE_POINTS = 256

/** Log-spaced 20 Hz – 20 kHz, the x axis of the response curve. */
const FREQS = (() => {
  const f = new Float32Array(CURVE_POINTS)
  for (let i = 0; i < CURVE_POINTS; i++) f[i] = 20 * Math.pow(1000, i / (CURVE_POINTS - 1))
  return f
})()

/**
 * The combined response of the seven filters, computed on the same
 * BiquadFilterNode maths the playback graph uses, so the curve is the sound.
 */
function responseDb(bands: number[]): Float32Array {
  const ctx = new OfflineAudioContext(1, 1, 44100)
  const total = new Float32Array(CURVE_POINTS)
  const mag = new Float32Array(CURVE_POINTS)
  const phase = new Float32Array(CURVE_POINTS)
  EQ_BANDS_HZ.forEach((hz, i) => {
    const f = ctx.createBiquadFilter()
    f.type = i === 0 ? 'lowshelf' : i === EQ_BANDS_HZ.length - 1 ? 'highshelf' : 'peaking'
    f.frequency.value = hz
    f.Q.value = EQ_Q
    f.gain.value = bands[i] ?? 0
    f.getFrequencyResponse(FREQS, mag, phase)
    for (let k = 0; k < CURVE_POINTS; k++) total[k] += 20 * Math.log10(mag[k])
  })
  return total
}

function Curve({ bands, enabled }: { bands: number[]; enabled: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const db = useMemo(() => responseDb(bands), [bands])
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)
    const style = getComputedStyle(canvas)
    const y = (v: number) => h / 2 - (v / EQ_RANGE_DB) * (h / 2 - 8)
    ctx.strokeStyle = style.getPropertyValue('--outline')
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, h / 2)
    ctx.lineTo(w, h / 2)
    ctx.stroke()
    const line = new Path2D()
    db.forEach((v, i) => {
      const x = (i / (CURVE_POINTS - 1)) * w
      if (i === 0) line.moveTo(x, y(v))
      else line.lineTo(x, y(v))
    })
    const fill = new Path2D(line)
    fill.lineTo(w, h / 2)
    fill.lineTo(0, h / 2)
    fill.closePath()
    const accent = enabled ? '#34c759' : style.getPropertyValue('--on-surface-variant')
    ctx.fillStyle = enabled ? 'rgba(52, 199, 89, 0.16)' : 'rgba(142, 142, 147, 0.12)'
    ctx.fill(fill)
    ctx.strokeStyle = accent
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.stroke(line)
  }, [db, enabled])
  return <canvas ref={ref} className="eq-curve" />
}

/** `EqualizerScreen.kt`: on/off, presets, seven bands and the curve they make. */
export function EqualizerScreen() {
  const { eqEnabled, eqBands, update } = useSettings()
  const preset = presetMatching(eqBands)
  const setBands = (bands: number[]) => update({ eqBands: bands, eqPreset: presetMatching(bands), eqEnabled: true })

  return (
    <PageScroll id="equalizer">
      <h1 className="page-title">Equalizer</h1>
      <div className="settings">
        <div className="settings-card">
          <label className="settings-row is-button">
            <div className="settings-row-text">
              <div className="settings-row-title">Equalizer</div>
              <div className="settings-row-subtitle">{eqEnabled ? preset : 'Off'}</div>
            </div>
            <input type="checkbox" className="switch" checked={eqEnabled} onChange={(e) => update({ eqEnabled: e.target.checked })} />
          </label>
        </div>

        <div className={`eq-panel ${eqEnabled ? '' : 'is-off'}`}>
          <Curve bands={eqBands} enabled={eqEnabled} />
          <div className="eq-bands">
            {EQ_BANDS_HZ.map((_, i) => (
              <div className="eq-band" key={i}>
                <span className="eq-band-db">{eqBands[i] > 0 ? '+' : ''}{(eqBands[i] ?? 0).toFixed(1)}</span>
                <input
                  type="range"
                  className="eq-slider"
                  min={-EQ_RANGE_DB}
                  max={EQ_RANGE_DB}
                  step={0.5}
                  value={eqBands[i] ?? 0}
                  aria-label={`${LABELS[i]} Hz`}
                  onChange={(e) => {
                    const next = [...eqBands]
                    next[i] = Number(e.target.value)
                    setBands(next)
                  }}
                  onDoubleClick={() => {
                    const next = [...eqBands]
                    next[i] = 0
                    setBands(next)
                  }}
                />
                <span className="eq-band-hz">{LABELS[i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="settings-group-title">Presets</div>
        <div className="eq-presets">
          {Object.keys(EQ_PRESETS).map((name) => (
            <button key={name} className={`filter-pill ${eqEnabled && preset === name ? 'is-selected' : ''}`} onClick={() => setBands(EQ_PRESETS[name])}>
              {name}
            </button>
          ))}
        </div>
      </div>
    </PageScroll>
  )
}
