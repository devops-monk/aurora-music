import { useEffect, useRef } from 'react'
import { artworkAt, CARD_ART_PX } from '@shared/models'
import { loadPixels } from '../theme/useArtworkPalette'
import { useSettings } from '../store/settings'

/**
 * The Now Playing background, after `ArtworkMeshBackdrop.kt`: the artwork's
 * own colours, sampled on a grid and drawn as large soft blobs that drift, over
 * a heavily blurred copy of the sleeve. The drift slows to a stop with Reduce
 * animation or while paused, like the mesh settling on Android.
 */

const GRID = 3
const MESH_PX = 48

type Blob = { r: number; g: number; b: number; x: number; y: number; phase: number; speed: number }

function lifted(r: number, g: number, b: number): [number, number, number] {
  // Mirror `Int.lifted()`: keep near-black sleeves from painting a dead black page.
  const max = Math.max(r, g, b)
  if (max >= 48) return [r, g, b]
  const k = 48 / Math.max(1, max)
  return [Math.min(255, r * k + 8), Math.min(255, g * k + 8), Math.min(255, b * k + 8)]
}

export function MeshBackdrop({ url, playing }: { url: string | null; playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const blobsRef = useRef<Blob[]>([])
  const reduce = useSettings((s) => s.reduceAnimation)
  const playingRef = useRef(playing)
  playingRef.current = playing && !reduce

  useEffect(() => {
    if (!url) return
    let alive = true
    loadPixels(artworkAt(url, CARD_ART_PX) ?? url, MESH_PX)
      .then((px) => {
        if (!alive) return
        const cell = MESH_PX / GRID
        const blobs: Blob[] = []
        for (let gy = 0; gy < GRID; gy++)
          for (let gx = 0; gx < GRID; gx++) {
            let r = 0
            let g = 0
            let b = 0
            let n = 0
            for (let y = gy * cell; y < (gy + 1) * cell; y++)
              for (let x = gx * cell; x < (gx + 1) * cell; x++) {
                const i = (y * MESH_PX + x) * 4
                r += px[i]
                g += px[i + 1]
                b += px[i + 2]
                n++
              }
            const [lr, lg, lb] = lifted(r / n, g / n, b / n)
            blobs.push({
              r: lr,
              g: lg,
              b: lb,
              x: (gx + 0.5) / GRID,
              y: (gy + 0.5) / GRID,
              phase: Math.random() * Math.PI * 2,
              speed: 0.00006 + Math.random() * 0.00008,
            })
          }
        blobsRef.current = blobs
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [url])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let raf = 0
    let t = 0
    let last = performance.now()
    const draw = (now: number) => {
      const dt = now - last
      last = now
      if (playingRef.current) t += dt
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)
      for (const blob of blobsRef.current) {
        const a = blob.phase + t * blob.speed * 6
        const cx = (blob.x + Math.cos(a) * 0.18) * w
        const cy = (blob.y + Math.sin(a * 1.3) * 0.18) * h
        const radius = Math.max(w, h) * 0.55
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
        grad.addColorStop(0, `rgba(${blob.r | 0}, ${blob.g | 0}, ${blob.b | 0}, 0.9)`)
        grad.addColorStop(1, `rgba(${blob.r | 0}, ${blob.g | 0}, ${blob.b | 0}, 0)`)
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, w, h)
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  const src = artworkAt(url, CARD_ART_PX)
  return (
    <div className="mesh-backdrop" aria-hidden>
      {src && <img className="mesh-art" src={src} alt="" key={src} />}
      <canvas ref={canvasRef} className="mesh-canvas" width={96} height={96} />
      <div className="mesh-shade" />
    </div>
  )
}
