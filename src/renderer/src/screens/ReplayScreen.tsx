import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ReplayMonth, ReplayRank } from '@shared/api'
import { artworkAt, CARD_ART_PX, HEADER_ART_PX, ROW_ART_PX, type Song } from '@shared/models'
import { PageScroll } from '../components/PageScroll'
import { Artwork, MessageState, SectionHeader } from '../components/Common'
import { PlayGlyph, ShareIcon } from '../components/Icons'
import { useArtworkPalette } from '../theme/useArtworkPalette'
import { usePlayer } from '../store/player'
import { useUi } from '../store/ui'
import { openItem } from '../lib/actions'
import { withAlpha } from '../lib/color'

/**
 * Replay: the month in listening (BitChord's `ReplayScreen.kt`), from plays
 * counted on this computer. A hero in the top song's colours, the ranked
 * lists, a day-by-day chart, and a poster to save and share.
 */

export const monthLabel = (key: string, withYear = true) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, withYear ? { month: 'long', year: 'numeric' } : { month: 'long' })
}

function useCountUp(target: number, ms = 1100) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return value
}

export function ReplayScreen() {
  const months = useQuery({ queryKey: ['replayMonths'], queryFn: () => window.aurora.replayMonths() })
  const [month, setMonth] = useState<string | null>(null)
  const current = month ?? months.data?.[0]
  const q = useQuery({
    queryKey: ['replay', current],
    queryFn: () => window.aurora.replay(current),
    enabled: months.isFetched,
  })

  return (
    <PageScroll id="replay">
      <h1 className="page-title">Replay</h1>
      {!!months.data?.length && (
        <div className="filter-pills">
          {months.data.map((m) => (
            <button key={m} className={`filter-pill ${m === current ? 'is-selected' : ''}`} onClick={() => setMonth(m)}>
              {monthLabel(m)}
            </button>
          ))}
        </div>
      )}
      {q.data && q.data.plays > 0 ? (
        <ReplayBody data={q.data} />
      ) : q.isFetched || months.isFetched ? (
        <MessageState message="Your Replay builds as you listen. Every song you hear for more than 30 seconds counts, and it stays on this computer." />
      ) : null}
    </PageScroll>
  )
}

function ReplayBody({ data }: { data: ReplayMonth }) {
  const hero = data.topSongs[0]?.thumbnailUrl ?? null
  const palette = useArtworkPalette(hero, true)
  const minutes = useCountUp(data.minutes)
  const [saving, setSaving] = useState(false)
  const topSongs = data.topSongs.map((r) => r.song).filter((s): s is Song => !!s)

  const savePoster = async () => {
    setSaving(true)
    try {
      const url = await renderPoster(data, palette?.background ?? '#1b1238', palette?.accent ?? '#5b8cff')
      if (await window.aurora.savePoster(url, data.month)) useUi.getState().showToast('Poster saved')
    } catch {
      useUi.getState().showToast('Could not render the poster')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div
        className="replay-hero"
        style={{
          background: `radial-gradient(120% 120% at 0% 0%, ${palette?.accent ?? '#5b8cff'} 0%, transparent 55%), radial-gradient(120% 120% at 100% 100%, ${palette?.wash ?? '#ff5fa2'} 0%, transparent 60%), ${palette?.background ?? '#1b1238'}`,
        }}
      >
        {hero && <img className="replay-hero-art" src={artworkAt(hero, HEADER_ART_PX)!} alt="" />}
        <div className="replay-hero-text">
          <div className="replay-hero-label">Your {monthLabel(data.month, false)}</div>
          <div className="replay-hero-number">{minutes.toLocaleString()}</div>
          <div className="replay-hero-unit">minutes listened</div>
          <div className="replay-hero-stats">
            <span>
              <b>{data.plays.toLocaleString()}</b> plays
            </span>
            <span>
              <b>{data.distinctSongs.toLocaleString()}</b> songs
            </span>
            <span>
              <b>{data.distinctArtists.toLocaleString()}</b> artists
            </span>
          </div>
          <div className="replay-hero-actions">
            <button className="play-pill" disabled={!topSongs.length} onClick={() => usePlayer.getState().playSongs(topSongs, 0, { source: `Replay · ${monthLabel(data.month)}` })}>
              <PlayGlyph size={24} />
              <span>Play top songs</span>
            </button>
            <button className="detail-circle" aria-label="Save poster" title="Save poster" onClick={savePoster} disabled={saving}>
              <ShareIcon size={20} />
            </button>
          </div>
          {data.memberSince && (
            <div className="replay-since">
              Listening with Aurora since {new Date(data.memberSince).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </div>
          )}
        </div>
      </div>

      <section className="shelf">
        <SectionHeader title="Top Songs" />
        <div className="replay-ranks">
          {data.topSongs.map((r, i) => (
            <RankRow key={r.key} rank={i + 1} item={r} onClick={() => usePlayer.getState().playSongs(topSongs, i, { source: `Replay · ${monthLabel(data.month)}` })} />
          ))}
        </div>
      </section>

      {data.topArtists.length > 0 && (
        <section className="shelf">
          <SectionHeader title="Top Artists" />
          <div className="replay-artists">
            {data.topArtists.slice(0, 6).map((a, i) => (
              <button
                key={a.key}
                className="replay-artist"
                onClick={() => a.browseId && useUi.getState().push({ kind: 'detail', browseId: a.browseId, title: a.title })}
              >
                <span className="replay-artist-rank">{i + 1}</span>
                <Artwork url={a.thumbnailUrl} px={CARD_ART_PX} round />
                <b className="ellipsis">{a.title}</b>
                <small>{a.minutes.toLocaleString()} min</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {data.topAlbums.length > 0 && (
        <section className="shelf">
          <SectionHeader title="Top Albums" />
          <div className="replay-ranks">
            {data.topAlbums.slice(0, 5).map((r, i) => (
              <RankRow
                key={r.key}
                rank={i + 1}
                item={r}
                onClick={() => r.browseId && openItem({ title: r.title, subtitle: r.subtitle, thumbnailUrl: r.thumbnailUrl, browseId: r.browseId, type: 'album' })}
              />
            ))}
          </div>
        </section>
      )}

      <section className="shelf">
        <SectionHeader title="Day by Day" subtitle={`${monthLabel(data.month)} · minutes per day`} />
        <DayChart values={data.perDayMinutes} accent={palette?.accent ?? '#5b8cff'} />
      </section>
    </>
  )
}

function RankRow({ rank, item, onClick }: { rank: number; item: ReplayRank; onClick: () => void }) {
  return (
    <div className="song-row replay-rank" onClick={onClick} role="button" tabIndex={0}>
      <span className="replay-rank-number">{rank}</span>
      <Artwork url={item.thumbnailUrl} px={ROW_ART_PX} radius={8} className="song-row-art" />
      <div className="song-row-text">
        <div className="song-row-title ellipsis">{item.title}</div>
        {item.subtitle && <div className="song-row-subtitle ellipsis">{item.subtitle}</div>}
      </div>
      <span className="replay-rank-stat">
        {item.plays} {item.plays === 1 ? 'play' : 'plays'} · {item.minutes} min
      </span>
    </div>
  )
}

function DayChart({ values, accent }: { values: number[]; accent: string }) {
  const max = Math.max(1, ...values)
  const [hover, setHover] = useState<number | null>(null)
  return (
    <div className="replay-chart" onMouseLeave={() => setHover(null)}>
      {values.map((v, i) => (
        <div key={i} className="replay-bar-wrap" onMouseEnter={() => setHover(i)}>
          <div className="replay-bar" style={{ height: `${Math.max(2, (v / max) * 100)}%`, background: v ? accent : undefined }} />
          {(i === 0 || (i + 1) % 5 === 0) && <span className="replay-bar-label">{i + 1}</span>}
        </div>
      ))}
      {hover !== null && (
        <div className="replay-chart-tip">
          Day {hover + 1}: <b>{values[hover]} min</b>
        </div>
      )}
    </div>
  )
}

// ---- the poster ---------------------------------------------------------------------

function loadImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1)
  return t + '…'
}

/** A 1080×1920 story poster, drawn to a canvas and returned as a PNG data URL. */
export async function renderPoster(data: ReplayMonth, bg: string, accent: string): Promise<string> {
  const W = 1080
  const H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const font = getComputedStyle(document.body).fontFamily

  // The artwork's own colours: its tint as the base, its accent glowing from the top
  // corner, a softer echo low on the other side, then a shade so white text always reads.
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  for (const [x, y, r, c, a] of [
    [0, 0, 1300, accent, 0.75],
    [W, H * 0.85, 1100, accent, 0.35],
  ] as const) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, withAlpha(c, a))
    g.addColorStop(1, withAlpha(c, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }
  const shade = ctx.createLinearGradient(0, 0, 0, H)
  shade.addColorStop(0, 'rgba(0, 0, 0, 0.05)')
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.45)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#fff'
  ctx.font = `700 40px ${font}`
  ctx.fillText('Aurora Replay', 80, 130)
  ctx.globalAlpha = 0.75
  ctx.font = `500 40px ${font}`
  ctx.fillText(monthLabel(data.month), 80, 185)
  ctx.globalAlpha = 1

  ctx.font = `800 220px ${font}`
  ctx.fillText(data.minutes.toLocaleString(), 72, 430)
  ctx.font = `600 46px ${font}`
  ctx.globalAlpha = 0.85
  ctx.fillText('minutes listened', 80, 500)
  ctx.font = `500 34px ${font}`
  ctx.fillText(`${data.plays} plays · ${data.distinctSongs} songs · ${data.distinctArtists} artists`, 80, 560)
  ctx.globalAlpha = 1

  ctx.font = `700 44px ${font}`
  ctx.fillText('Top Songs', 80, 690)
  const arts = await Promise.all(data.topSongs.slice(0, 5).map((s) => loadImage(artworkAt(s.thumbnailUrl, 240))))
  data.topSongs.slice(0, 5).forEach((s, i) => {
    const y = 730 + i * 150
    ctx.font = `800 52px ${font}`
    ctx.globalAlpha = 0.7
    ctx.fillText(String(i + 1), 80, y + 82)
    ctx.globalAlpha = 1
    const img = arts[i]
    ctx.save()
    roundRect(ctx, 150, y, 120, 120, 16)
    ctx.clip()
    if (img) ctx.drawImage(img, 150, y, 120, 120)
    else {
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.fillRect(150, y, 120, 120)
    }
    ctx.restore()
    ctx.fillStyle = '#fff'
    ctx.font = `700 44px ${font}`
    ctx.fillText(fit(ctx, s.title, 700), 300, y + 55)
    ctx.globalAlpha = 0.75
    ctx.font = `500 34px ${font}`
    ctx.fillText(fit(ctx, `${s.subtitle} · ${s.plays} plays`, 700), 300, y + 102)
    ctx.globalAlpha = 1
  })

  ctx.font = `700 44px ${font}`
  ctx.fillText('Top Artists', 80, 1560)
  ctx.font = `600 40px ${font}`
  data.topArtists.slice(0, 3).forEach((a, i) => {
    ctx.globalAlpha = i === 0 ? 1 : 0.8
    ctx.fillText(fit(ctx, `${i + 1}. ${a.title}`, 900), 80, 1630 + i * 62)
  })
  ctx.globalAlpha = 0.6
  ctx.font = `600 30px ${font}`
  ctx.fillText('aurora.devops-monk.com', 80, H - 70)
  ctx.globalAlpha = 1
  return canvas.toDataURL('image/png')
}

// Read-only hook for inspecting the poster from DevTools.
;(window as unknown as { __auroraPoster: typeof renderPoster }).__auroraPoster = renderPoster
