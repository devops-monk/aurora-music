import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { formatTime } from '@shared/models'
import { usePlayer } from '../store/player'
import { next, previous, seekTo, togglePlay } from '../audio/engine'
import { Spinner } from '../components/Common'
import {
  HeartIcon,
  LyricsIcon,
  MoreIcon,
  PeopleIcon,
  NextGlyph,
  PauseGlyph,
  PlayGlyph,
  PreviousGlyph,
  QueueIcon,
  VolumeDownIcon,
  VolumeUpIcon,
} from '../components/Icons'
import { openSongMenu, toggleLike } from '../lib/actions'
import { useUi } from '../store/ui'
import { useParty, inParty } from '../store/party'

/**
 * `ThinSlider` from PlayerControls.kt: a hairline track that thickens under
 * the pointer (6 → 10px), filled in translucent white. [onScrub] fires while
 * dragging, [onCommit] once on release.
 */
export function ThinSlider({
  value,
  onScrub,
  onCommit,
  label,
}: {
  value: number
  onScrub?: (v: number) => void
  onCommit: (v: number) => void
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<number | null>(null)
  const at = (e: ReactPointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  }
  const shown = drag ?? value
  return (
    <div
      ref={ref}
      className={`thin-slider ${drag !== null ? 'is-active' : ''}`}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(shown * 100)}
      tabIndex={0}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        const v = at(e)
        setDrag(v)
        onScrub?.(v)
      }}
      onPointerMove={(e) => {
        if (drag === null) return
        const v = at(e)
        setDrag(v)
        onScrub?.(v)
      }}
      onPointerUp={(e) => {
        if (drag === null) return
        onCommit(at(e))
        setDrag(null)
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') onCommit(Math.min(1, value + 0.02))
        if (e.key === 'ArrowLeft') onCommit(Math.max(0, value - 0.02))
      }}
    >
      <div className="thin-slider-track">
        <div className="thin-slider-fill" style={{ transform: `scaleX(${shown})` }} />
      </div>
    </div>
  )
}

/** `PlayerScrubber`: the slider, elapsed on the left, remaining on the right, quality in the middle. */
export function Scrubber() {
  const positionMs = usePlayer((s) => s.positionMs)
  const durationMs = usePlayer((s) => s.durationMs)
  const stream = usePlayer((s) => s.stream)
  const [scrub, setScrub] = useState<number | null>(null)
  const fraction = durationMs > 0 ? positionMs / durationMs : 0
  const shownMs = scrub !== null ? scrub * durationMs : positionMs
  const codec = !stream
    ? null
    : stream.mimeType === 'local'
      ? 'LOCAL FILE'
      : stream.mimeType.includes('downloaded')
        ? 'DOWNLOADED'
        : stream.mimeType.includes('opus')
          ? 'OPUS'
          : stream.mimeType.includes('mp4a')
            ? 'AAC'
            : null
  const kbps = stream?.bitrate ? ` · ${Math.round(stream.bitrate / 1000)} KBPS` : ''
  return (
    <div className="scrubber">
      <ThinSlider
        label="Seek"
        value={scrub ?? fraction}
        onScrub={setScrub}
        onCommit={(v) => {
          seekTo(v * durationMs)
          setScrub(null)
        }}
      />
      <div className="scrubber-times">
        <span>{formatTime(shownMs)}</span>
        {codec && (
          <span className="quality-label">
            {codec}
            {kbps}
          </span>
        )}
        <span>-{formatTime(Math.max(0, durationMs - shownMs))}</span>
      </div>
    </div>
  )
}

/** `TransportRow`: previous, a 74px play/pause (58 compact), next. */
export function Transport({ compact = false }: { compact?: boolean }) {
  const isPlaying = usePlayer((s) => s.isPlaying)
  const isLoading = usePlayer((s) => s.isLoading)
  const hasNext = usePlayer((s) => s.index + 1 < s.songs.length || s.repeat === 'all')
  const play = compact ? 58 : 74
  const skip = compact ? 44 : 53
  return (
    <div className="transport">
      <button className="transport-glyph" aria-label="Previous" onClick={previous} style={{ width: skip, height: skip }}>
        <PreviousGlyph size={skip} style={{ transform: 'scaleY(0.85)' }} />
      </button>
      <button
        className="transport-glyph is-play"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        onClick={togglePlay}
        style={{ width: play + 18, height: play + 18 }}
      >
        {isLoading ? <Spinner size={compact ? 30 : 38} /> : isPlaying ? <PauseGlyph size={play} /> : <PlayGlyph size={play} />}
      </button>
      <button
        className="transport-glyph"
        aria-label="Next"
        onClick={next}
        disabled={!hasNext}
        style={{ width: skip, height: skip }}
      >
        <NextGlyph size={skip} style={{ transform: 'scaleY(0.85)' }} />
      </button>
    </div>
  )
}

export function VolumeRow() {
  const volume = usePlayer((s) => s.volume)
  return (
    <div className="volume-row">
      <VolumeDownIcon />
      <ThinSlider label="Volume" value={volume} onScrub={(v) => usePlayer.getState().setVolume(v)} onCommit={(v) => usePlayer.getState().setVolume(v)} />
      <VolumeUpIcon />
    </div>
  )
}

/** `CircleGlyph`: a 34px translucent disc, brighter when [active]. */
function CircleGlyph({ active, label, onClick, children }: { active?: boolean; label: string; onClick: (e: React.MouseEvent) => void; children: React.ReactNode }) {
  return (
    <button className={`circle-glyph ${active ? 'is-active' : ''}`} aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  )
}

/** The row under the transport: lyrics and queue toggles, like, more. */
export function PlayerActionRow() {
  const pane = usePlayer((s) => s.pane)
  const song = usePlayer((s) => s.current())
  const liked = usePlayer((s) => (song ? !!s.liked[song.videoId] : false))
  const partying = useParty((p) => inParty(p))
  if (!song) return null
  return (
    <div className="player-action-row">
      <CircleGlyph label="Lyrics" active={pane === 'lyrics'} onClick={() => usePlayer.getState().setPane('lyrics')}>
        <LyricsIcon size={19} />
      </CircleGlyph>
      <CircleGlyph label={liked ? 'Unlike' : 'Like'} active={liked} onClick={() => toggleLike(song)}>
        <HeartIcon size={19} filled={liked} />
      </CircleGlyph>
      <CircleGlyph label="Queue" active={pane === 'queue'} onClick={() => usePlayer.getState().setPane('queue')}>
        <QueueIcon size={19} />
      </CircleGlyph>
      <CircleGlyph
        label="Listen Together"
        active={partying}
        onClick={() => {
          usePlayer.getState().closeNowPlaying()
          useUi.getState().push({ kind: 'party' })
        }}
      >
        <PeopleIcon size={19} />
      </CircleGlyph>
      <CircleGlyph
        label="More"
        onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
          openSongMenu(song, { x: r.left, y: r.top - 8 })
        }}
      >
        <MoreIcon size={19} />
      </CircleGlyph>
    </div>
  )
}
