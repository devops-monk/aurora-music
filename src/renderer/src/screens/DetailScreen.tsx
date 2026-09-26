import { useMemo, useState, type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { artworkAt, durationMillis, HEADER_ART_PX, type DetailPage, type Song } from '@shared/models'
import { MessageState, SectionHeader, Shelf, SongRow } from '../components/Common'
import { RowsSkeleton } from '../components/Skeletons'
import { PageScroll } from '../components/PageScroll'
import { CloseIcon, PlayGlyph, SearchIcon, ShuffleIcon } from '../components/Icons'
import { useArtworkPalette } from '../theme/useArtworkPalette'
import { useIsDark } from '../theme/useTheme'
import { usePlayer } from '../store/player'
import { useUi } from '../store/ui'

/**
 * `DetailScreen.kt`: an album, playlist or artist page, painted in the
 * artwork's own colours (`ArtworkPalette`). Release pages carry the sleeve over
 * a wash of itself, then title, the artist in the accent, the meta line, and
 * the circle/pill action row. Artist pages lead with the photo, full bleed.
 */
export function DetailScreen({ browseId }: { browseId: string }) {
  const q = useQuery({ queryKey: ['browse', browseId], queryFn: () => window.aurora.browse(browseId) })
  const dark = useIsDark()
  const palette = useArtworkPalette(q.data?.thumbnailUrl, dark)
  const [more, setMore] = useState<Song[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [exhausted, setExhausted] = useState(false)

  const style = palette
    ? ({
        '--page-bg': palette.background,
        '--page-wash': palette.wash,
        '--page-elevated': palette.elevated,
        '--page-accent': palette.accent,
        '--page-on': palette.onBackground,
        '--page-on-variant': palette.onBackgroundVariant,
        '--page-divider': palette.divider,
      } as CSSProperties)
    : undefined

  const loadMore = async () => {
    if (!q.data?.hasContinuation || exhausted || loadingMore) return
    setLoadingMore(true)
    try {
      const next = await window.aurora.browseMore(browseId)
      setMore((m) => [...m, ...next])
      if (!next.length) setExhausted(true)
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <PageScroll id={`detail:${browseId}`} className="detail-page" style={style} onEndReached={loadMore}>
      {q.isPending ? (
        <div className="detail-loading">
          <div className="detail-sleeve skeleton" />
          <RowsSkeleton />
        </div>
      ) : q.isError ? (
        <MessageState message="Couldn't load this page." action="Retry" onAction={() => q.refetch()} />
      ) : q.data.type === 'artist' ? (
        <ArtistBody page={q.data} />
      ) : (
        <ReleaseBody page={q.data} songs={[...q.data.songs, ...more]} loadingMore={loadingMore} />
      )}
    </PageScroll>
  )
}

function Backdrop({ url }: { url: string | null }) {
  const src = artworkAt(url, HEADER_ART_PX)
  return (
    <div className="detail-backdrop" aria-hidden>
      {src && <img src={src} alt="" />}
      <div className="detail-backdrop-fade" />
    </div>
  )
}

function ActionRow({ onPlay, onShuffle, children }: { onPlay: () => void; onShuffle: () => void; children?: React.ReactNode }) {
  return (
    <div className="detail-actions">
      <button className="detail-circle" aria-label="Shuffle" onClick={onShuffle}>
        <ShuffleIcon size={22} />
      </button>
      <button className="play-pill" onClick={onPlay}>
        <PlayGlyph size={26} />
        <span>Play</span>
      </button>
      {children}
    </div>
  )
}

function totalDuration(songs: Song[]) {
  const ms = songs.reduce((sum, s) => sum + durationMillis(s.durationText), 0)
  if (!ms) return ''
  const minutes = Math.round(ms / 60000)
  return minutes >= 60 ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min` : `${minutes} min`
}

function ReleaseBody({ page, songs, loadingMore }: { page: DetailPage; songs: Song[]; loadingMore: boolean }) {
  const [searching, setSearching] = useState(false)
  const [filter, setFilter] = useState('')
  const isAlbum = page.type === 'album'
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase()
    return songs
      .map((song, index) => ({ song, index }))
      .filter(({ song }) => !f || song.title.toLowerCase().includes(f) || song.artist.toLowerCase().includes(f))
  }, [songs, filter])
  const play = (index = 0, shuffle = false) =>
    usePlayer.getState().playSongs(songs, index, { source: page.title, playlistId: page.playlistId, shuffle })
  const meta = page.secondSubtitle || [isAlbum ? 'Album' : 'Playlist', `${songs.length} songs`, totalDuration(songs)].filter(Boolean).join(' · ')

  return (
    <>
      <div className="detail-header">
        <Backdrop url={page.thumbnailUrl} />
        <div className="detail-sleeve">
          {page.thumbnailUrl && <img src={artworkAt(page.thumbnailUrl, HEADER_ART_PX)!} alt="" />}
        </div>
        <h1 className="detail-title">{page.title}</h1>
        {page.subtitle && (
          <button
            className="detail-credit"
            disabled={!page.artistId}
            onClick={() => page.artistId && useUi.getState().push({ kind: 'detail', browseId: page.artistId, title: page.subtitle })}
          >
            {page.subtitle}
          </button>
        )}
        {meta && <div className="detail-meta">{meta.toUpperCase()}</div>}
        {songs.length > 0 && (
          <ActionRow onPlay={() => play(0)} onShuffle={() => play(0, true)}>
            <button
              className="detail-circle"
              aria-label={searching ? 'Close search' : 'Search this list'}
              onClick={() => {
                setSearching((s) => !s)
                setFilter('')
              }}
            >
              {searching ? <CloseIcon size={20} /> : <SearchIcon size={22} />}
            </button>
          </ActionRow>
        )}
      </div>
      <div className="detail-body">
        {searching && (
          <div className="pill-field detail-search">
            <SearchIcon size={18} />
            <input autoFocus value={filter} placeholder="Find in list" onChange={(e) => setFilter(e.target.value)} />
          </div>
        )}
        <div className="detail-tracks">
          {shown.map(({ song, index }) => (
            <SongRow
              key={song.videoId + index}
              song={song}
              trackNumber={isAlbum ? index + 1 : undefined}
              onPlay={() => play(index)}
            />
          ))}
          {loadingMore && <RowsSkeleton count={4} />}
        </div>
        {isAlbum && songs.length > 0 && <div className="detail-footer">{`${songs.length} songs, ${totalDuration(songs)}`}</div>}
        {page.description && <About title={isAlbum ? 'About' : 'Description'} text={page.description} />}
        {page.sections.map((shelf, i) => (
          <Shelf key={shelf.title + i} shelf={shelf} />
        ))}
      </div>
    </>
  )
}

function ArtistBody({ page }: { page: DetailPage }) {
  const radio = () => {
    const first = page.songs[0]
    if (first) usePlayer.getState().playRadio(first, `${page.title} Radio`)
  }
  return (
    <>
      <div className="artist-header">
        <div className="artist-photo">
          {page.thumbnailUrl && <img src={artworkAt(page.thumbnailUrl, HEADER_ART_PX)!} alt="" />}
          <div className="artist-photo-fade" />
        </div>
        <h1 className="artist-name">{page.title}</h1>
        {page.subscriberText && <div className="detail-meta">{page.subscriberText.toUpperCase()}</div>}
        <ActionRow
          onPlay={() => usePlayer.getState().playSongs(page.songs, 0, { source: page.title, playlistId: page.playlistId })}
          onShuffle={() =>
            page.songs.length ? usePlayer.getState().playSongs(page.songs, 0, { source: page.title, shuffle: true }) : radio()
          }
        />
      </div>
      <div className="detail-body">
        {page.songs.length > 0 && (
          <section className="shelf">
            <SectionHeader
              title="Top Songs"
              onShowAll={
                page.moreSongsBrowseId
                  ? () => useUi.getState().push({ kind: 'detail', browseId: page.moreSongsBrowseId!, title: `${page.title}: Songs` })
                  : undefined
              }
            />
            <div className="artist-top-songs">
              {page.songs.slice(0, 10).map((song, i) => (
                <SongRow
                  key={song.videoId}
                  song={song}
                  onPlay={() => usePlayer.getState().playSongs(page.songs, i, { source: page.title, playlistId: page.playlistId })}
                />
              ))}
            </div>
          </section>
        )}
        {page.sections.map((shelf, i) => (
          <Shelf key={shelf.title + i} shelf={shelf} />
        ))}
        {page.description && <About title={`About ${page.title}`} text={page.description} />}
      </div>
    </>
  )
}

function About({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="about">
      <SectionHeader title={title} />
      <p className={`about-text ${open ? 'is-open' : ''}`} onClick={() => setOpen((o) => !o)}>
        {text}
      </p>
    </section>
  )
}
