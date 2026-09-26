import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { LyricLine, Song } from '@shared/models'
import { activeLineIndex } from '@shared/lyrics'
import { getPositionMs, seekTo } from '../audio/engine'
import { usePlayer } from '../store/player'
import { useSettings } from '../store/settings'
import { Spinner } from '../components/Common'

/**
 * Apple Music-style lyrics (BitChord's `PlayerLyrics.kt`, after binimum's
 * am-lyrics): the active line bright and full-size, the rest dimmed and
 * softened with distance, words filling left to right as they are sung, and
 * the list gliding so the active line sits a third of the way down. Scrolling
 * by hand pauses the follow for a few seconds; clicking a line seeks to it.
 */

/** Where the active line rests, as a fraction of the pane's height. */
const ANCHOR = 0.3
const USER_SCROLL_HOLD_MS = 3500

export function Lyrics({ song }: { song: Song }) {
  const durationMs = usePlayer((s) => s.durationMs)
  const q = useQuery({
    queryKey: ['lyrics', song.videoId],
    queryFn: () => window.aurora.lyrics(song, durationMs),
    staleTime: Infinity,
    enabled: durationMs > 0,
  })

  if (q.isPending) return <div className="lyrics-state"><Spinner size={28} /></div>
  if (!q.data || !q.data.lines.length) return <div className="lyrics-state">No lyrics for this song.</div>
  if (!q.data.synced)
    return (
      <div className="lyrics-scroll is-plain">
        {q.data.lines.map((l, i) => (
          <p key={i} className="lyric-line is-plain">
            {l.text}
          </p>
        ))}
        <div className="lyrics-source">Lyrics from {q.data.source}</div>
      </div>
    )
  return <SyncedLyrics lines={q.data.lines} source={q.data.source} />
}

function SyncedLyrics({ lines, source }: { lines: LyricLine[]; source: string }) {
  const paneRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<(HTMLDivElement | null)[]>([])
  const [active, setActive] = useState(-1)
  const heldUntil = useRef(0)
  const reduce = useSettings((s) => s.reduceAnimation)

  // Word fill and active-line tracking run off the audio clock every frame,
  // outside React: re-rendering the list sixty times a second is what would stutter.
  useEffect(() => {
    let raf = 0
    let lastActive = -2
    const tick = () => {
      const ms = getPositionMs()
      const idx = activeLineIndex(lines, ms)
      if (idx !== lastActive) {
        lastActive = idx
        setActive(idx)
      }
      for (const i of [idx, idx + 1]) {
        const line = lines[i]
        const el = lineRefs.current[i]
        if (!line?.words || !el) continue
        const words = el.querySelectorAll<HTMLElement>('.lyric-word')
        line.words.forEach((w, wi) => {
          const span = Math.max(1, w.end - w.start)
          const p = Math.min(1, Math.max(0, (ms - w.start) / span))
          words[wi]?.style.setProperty('--p', String(p))
        })
      }
      // Background vocals that overlap the active line fill alongside it.
      lines.forEach((line, i) => {
        if (!line.background || !line.words) return
        const el = lineRefs.current[i]
        if (!el || ms < line.start - 500 || ms > line.end + 500) return
        el.querySelectorAll<HTMLElement>('.lyric-word').forEach((span, wi) => {
          const w = line.words![wi]
          span.style.setProperty('--p', String(Math.min(1, Math.max(0, (ms - w.start) / Math.max(1, w.end - w.start)))))
        })
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [lines])

  // Glide the list so the active line rests at ANCHOR.
  useLayoutEffect(() => {
    const pane = paneRef.current
    const el = lineRefs.current[Math.max(0, active)]
    if (!pane || !el || Date.now() < heldUntil.current) return
    const target = el.offsetTop - pane.clientHeight * ANCHOR
    pane.scrollTo({ top: Math.max(0, target), behavior: reduce ? 'auto' : 'smooth' })
  }, [active, reduce])

  return (
    <div
      className="lyrics-scroll"
      ref={paneRef}
      onWheel={() => (heldUntil.current = Date.now() + USER_SCROLL_HOLD_MS)}
    >
      <div className="lyrics-list" ref={listRef}>
        {lines.map((line, i) => {
          const distance = active < 0 ? i + 1 : Math.abs(i - active)
          const isActive = i === active || (line.background && active >= 0 && line.start <= lines[active].end && line.end >= lines[active].start)
          const past = active >= 0 && i < active && !isActive
          const blur = isActive || reduce ? 0 : Math.min(3, distance * 0.7)
          return (
            <div
              key={i}
              ref={(el) => {
                lineRefs.current[i] = el
              }}
              className={[
                'lyric-line',
                isActive ? 'is-active' : '',
                past ? 'is-past' : '',
                line.background ? 'is-background' : '',
                line.oppositeTurn ? 'is-opposite' : '',
                line.text === '' ? 'is-gap' : '',
              ].join(' ')}
              style={{ filter: blur ? `blur(${blur}px)` : undefined }}
              onClick={() => seekTo(line.start)}
            >
              {line.text === '' ? (
                <span className="lyric-dots">
                  <i />
                  <i />
                  <i />
                </span>
              ) : line.words?.length ? (
                line.words.map((w, wi) => (
                  <span key={wi} className="lyric-word">
                    {w.text}{' '}
                  </span>
                ))
              ) : (
                line.text
              )}
            </div>
          )
        })}
        <div className="lyrics-source">Lyrics from {source}</div>
      </div>
    </div>
  )
}
