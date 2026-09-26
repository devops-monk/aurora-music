import { memo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { artworkAt, CARD_ART_PX, HEADER_ART_PX, ROW_ART_PX, type ShelfItem, type Song } from '@shared/models'
import { usePlayer } from '../store/player'
import { openItem, openItemMenu, openSongMenu } from '../lib/actions'
import { ChevronLeftIcon, ChevronRightIcon, EqualizerIcon, MoreIcon, MusicNoteIcon, PlayGlyph } from './Icons'

/** Artwork with the hairline border (`thumbnailBorder`) and a note placeholder. */
export function Artwork({
  url,
  px,
  radius,
  className = '',
  style,
  round,
}: {
  url: string | null | undefined
  px: number
  radius?: number
  className?: string
  style?: CSSProperties
  round?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const src = artworkAt(url, px)
  return (
    <div
      className={`artwork ${className}`}
      style={{ borderRadius: round ? '50%' : radius, ...style }}
    >
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)} />
      ) : (
        <MusicNoteIcon className="artwork-placeholder" />
      )}
    </div>
  )
}

export function ExplicitBadge() {
  return (
    <span className="explicit" aria-label="Explicit">
      E
    </span>
  )
}

const menuAt = (e: MouseEvent) => ({ x: e.clientX, y: e.clientY })

/** `SongRow` from Common.kt: 52px art (or track number), title, artist, duration. */
export const SongRow = memo(function SongRow({
  song,
  onPlay,
  trackNumber,
  showArt = true,
}: {
  song: Song
  onPlay: () => void
  trackNumber?: number
  showArt?: boolean
}) {
  const isCurrent = usePlayer((s) => s.current()?.videoId === song.videoId)
  const isPlaying = usePlayer((s) => s.isPlaying)
  return (
    <div
      className={`song-row ${isCurrent ? 'is-current' : ''}`}
      onClick={onPlay}
      onContextMenu={(e) => {
        e.preventDefault()
        openSongMenu(song, menuAt(e))
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onPlay()}
    >
      {trackNumber !== undefined ? (
        <div className="song-row-number">
          {isCurrent ? isPlaying ? <EqualizerIcon /> : <PlayGlyph size={22} /> : <span>{trackNumber}</span>}
        </div>
      ) : showArt ? (
        <div className="song-row-art">
          <Artwork url={song.thumbnailUrl} px={ROW_ART_PX} radius={8} />
          <div className="song-row-art-hover">
            <PlayGlyph size={24} />
          </div>
        </div>
      ) : null}
      <div className="song-row-text">
        <div className="song-row-title">
          <span className="ellipsis">{song.title}</span>
          {song.explicit && <ExplicitBadge />}
        </div>
        <div className="song-row-subtitle ellipsis">{song.artist}</div>
      </div>
      {isCurrent && trackNumber === undefined && (
        <span className="song-row-eq">{isPlaying ? <EqualizerIcon /> : <PlayGlyph size={20} />}</span>
      )}
      {song.durationText && <span className="song-row-duration">{song.durationText}</span>}
      <button
        className="icon-button song-row-more"
        aria-label="More"
        onClick={(e) => {
          e.stopPropagation()
          const r = e.currentTarget.getBoundingClientRect()
          openSongMenu(song, { x: r.left, y: r.bottom })
        }}
      >
        <MoreIcon size={20} />
      </button>
    </div>
  )
})

/** `SectionHeader` from HomeScreen.kt. */
export function SectionHeader({
  title,
  subtitle,
  onShowAll,
  trailing,
}: {
  title: string
  subtitle?: string
  onShowAll?: () => void
  trailing?: ReactNode
}) {
  return (
    <div className="section-header">
      <div className="section-header-text">
        <h2 className="section-header-title">{title}</h2>
        {subtitle && <div className="section-header-strapline ellipsis">{subtitle}</div>}
      </div>
      {trailing}
      {onShowAll && (
        <button className="text-button" onClick={onShowAll}>
          Show All
        </button>
      )}
    </div>
  )
}

/** `ShelfCard` from HomeScreen.kt: square 12px-radius art, title, subtitle. */
export const ShelfCard = memo(function ShelfCard({ item, width }: { item: ShelfItem; width?: number }) {
  const round = item.type === 'artist'
  return (
    <div
      className={`shelf-card ${round ? 'is-artist' : ''}`}
      style={width ? { width } : undefined}
      onClick={() => openItem(item)}
      onContextMenu={(e) => {
        e.preventDefault()
        openItemMenu(item, menuAt(e))
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && openItem(item)}
    >
      <div className="shelf-card-art">
        <Artwork url={item.thumbnailUrl} px={CARD_ART_PX} radius={12} round={round} />
        {(item.videoId || item.type === 'album' || item.type === 'playlist') && (
          <button
            className="card-play"
            aria-label="Play"
            onClick={async (e) => {
              e.stopPropagation()
              if (item.videoId) return openItem(item)
              const page = await window.aurora.browse(item.browseId!)
              usePlayer.getState().playSongs(page.songs, 0, { source: page.title, playlistId: page.playlistId })
            }}
          >
            <PlayGlyph size={22} />
          </button>
        )}
      </div>
      <div className="shelf-card-title ellipsis">{item.title}</div>
      {item.subtitle && <div className="shelf-card-subtitle ellipsis">{item.subtitle}</div>}
    </div>
  )
})

/** `HeroCard` from HomeScreen.kt: 0.92 aspect, 18px radius, bottom gradient. */
export function HeroCard({ item }: { item: ShelfItem }) {
  return (
    <div
      className="hero-card"
      onClick={() => openItem(item)}
      onContextMenu={(e) => {
        e.preventDefault()
        openItemMenu(item, menuAt(e))
      }}
      role="button"
      tabIndex={0}
    >
      <Artwork url={item.thumbnailUrl} px={HEADER_ART_PX} radius={18} />
      <div className="hero-card-scrim">
        <div className="hero-card-title ellipsis">{item.title}</div>
        {item.subtitle && <div className="hero-card-subtitle">{item.subtitle}</div>}
      </div>
    </div>
  )
}

/** A horizontally scrolling row, with the paging arrows a pointer needs in place of a swipe. */
export function HScroll({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const page = (dir: 1 | -1) => {
    const el = ref.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }
  return (
    <div className={`hscroll-wrap ${className}`}>
      <div className="hscroll" ref={ref}>
        {children}
      </div>
      <button className="hscroll-arrow is-left" aria-label="Scroll left" onClick={() => page(-1)}>
        <ChevronLeftIcon size={20} />
      </button>
      <button className="hscroll-arrow is-right" aria-label="Scroll right" onClick={() => page(1)}>
        <ChevronRightIcon size={20} />
      </button>
    </div>
  )
}

const SONGS_PER_COLUMN = 4

/** A shelf of songs: pages of four rows side by side, like the Android "Quick picks". */
export function SongShelf({ items, source }: { items: ShelfItem[]; source?: string }) {
  const songs = items.map((i) => i.song).filter((s): s is Song => !!s)
  const columns: Song[][] = []
  for (let i = 0; i < songs.length; i += SONGS_PER_COLUMN) columns.push(songs.slice(i, i + SONGS_PER_COLUMN))
  return (
    <HScroll className="song-shelf">
      {columns.map((column, c) => (
        <div className="song-column" key={c}>
          {column.map((song, r) => (
            <SongRow
              key={song.videoId}
              song={song}
              onPlay={() => usePlayer.getState().playSongs(songs, c * SONGS_PER_COLUMN + r, { source })}
            />
          ))}
        </div>
      ))}
    </HScroll>
  )
}

export function Shelf({ shelf, hero }: { shelf: import('@shared/models').HomeShelf; hero?: boolean }) {
  return (
    <section className="shelf">
      <SectionHeader title={shelf.title} subtitle={shelf.subtitle} />
      {shelf.layout === 'songs' ? (
        <SongShelf items={shelf.items} source={shelf.title} />
      ) : (
        <HScroll>
          {shelf.items.map((item, i) =>
            hero ? <HeroCard key={(item.browseId ?? item.videoId ?? '') + i} item={item} /> : <ShelfCard key={(item.browseId ?? item.videoId ?? '') + i} item={item} />,
          )}
        </HScroll>
      )}
    </section>
  )
}

export function MessageState({ message, action, onAction }: { message: string; action?: string; onAction?: () => void }) {
  return (
    <div className="message-state">
      <p>{message}</p>
      {action && onAction && (
        <button className="pill-button" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  )
}

export function Spinner({ size = 22 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} />
}
