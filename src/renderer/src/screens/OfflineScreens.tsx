import { useQuery } from '@tanstack/react-query'
import type { Song } from '@shared/models'
import { MessageState, SongRow } from '../components/Common'
import { RowsSkeleton } from '../components/Skeletons'
import { PageScroll } from '../components/PageScroll'
import { CloseIcon, DownloadIcon, PlayGlyph, ShuffleIcon } from '../components/Icons'
import { useDownloads } from '../store/downloads'
import { usePlayer } from '../store/player'
import { queryClient } from '../lib/query'

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

function ListHeader({ title, subtitle, songs, source, children }: { title: string; subtitle: string; songs: Song[]; source: string; children?: React.ReactNode }) {
  return (
    <div className="list-header">
      <div className="list-header-text">
        <h1 className="page-title">{title}</h1>
        <div className="list-header-subtitle">{subtitle}</div>
      </div>
      <div className="detail-actions">
        {songs.length > 0 && (
          <>
            <button className="detail-circle" aria-label="Shuffle" onClick={() => usePlayer.getState().playSongs(songs, 0, { source, shuffle: true })}>
              <ShuffleIcon size={22} />
            </button>
            <button className="play-pill" onClick={() => usePlayer.getState().playSongs(songs, 0, { source })}>
              <PlayGlyph size={26} />
              <span>Play</span>
            </button>
          </>
        )}
        {children}
      </div>
    </div>
  )
}

/** Downloaded songs, with live progress for ones still coming in (`DownloadManagerSheet.kt`). */
export function DownloadsScreen() {
  const list = useDownloads((s) => s.list)
  const done = list.filter((e) => e.state === 'done').map((e) => e.song)
  const pending = list.filter((e) => e.state !== 'done')
  return (
    <PageScroll id="downloads">
      <ListHeader title="Downloads" subtitle={`${plural(done.length, 'song')} · saved in Music/Aurora Music`} songs={done} source="Downloads">
        <button className="outlined-button" onClick={() => window.aurora.revealDownloads()}>
          Show in folder
        </button>
      </ListHeader>
      <div className="detail-tracks">
        {pending.map((e) => (
          <div key={e.song.videoId} className="song-row download-row">
            <div className="download-ring" style={{ '--p': e.progress } as React.CSSProperties}>
              <DownloadIcon size={18} />
            </div>
            <div className="song-row-text">
              <div className="song-row-title ellipsis">{e.song.title}</div>
              <div className="song-row-subtitle ellipsis">
                {e.state === 'error' ? `Failed: ${e.error ?? 'unknown error'}` : `${Math.round(e.progress * 100)}% · ${e.song.artist}`}
              </div>
            </div>
            <button className="icon-button" aria-label="Cancel" onClick={() => window.aurora.removeDownload(e.song.videoId)}>
              <CloseIcon size={18} />
            </button>
          </div>
        ))}
        {done.map((song, i) => (
          <SongRow key={song.videoId} song={song} onPlay={() => usePlayer.getState().playSongs(done, i, { source: 'Downloads' })} />
        ))}
        {!list.length && <MessageState message="Songs you download play offline and appear here. Right-click any song and choose Download." />}
      </div>
    </PageScroll>
  )
}

/** Music files from folders on this computer (`LocalMusicScreen.kt`). */
export function LocalMusicScreen() {
  const q = useQuery({ queryKey: ['local'], queryFn: () => window.aurora.localSongs(false), staleTime: Infinity })
  const folders = useQuery({ queryKey: ['localFolders'], queryFn: async () => (await window.aurora.getSettings()).localFolders })
  const songs = q.data ?? []
  const refresh = async (list?: string[]) => {
    if (list) queryClient.setQueryData(['localFolders'], list)
    queryClient.setQueryData(['local'], await window.aurora.localSongs(false))
  }
  return (
    <PageScroll id="local">
      <ListHeader title="Local Music" subtitle={`${plural(songs.length, 'song')} from ${plural(folders.data?.length ?? 0, 'folder')}`} songs={songs} source="Local Music">
        <button className="outlined-button" onClick={async () => refresh(await window.aurora.addLocalFolder())}>
          Add folder
        </button>
        {!!folders.data?.length && (
          <button className="outlined-button" onClick={async () => queryClient.setQueryData(['local'], await window.aurora.localSongs(true))}>
            Rescan
          </button>
        )}
      </ListHeader>
      {!!folders.data?.length && (
        <div className="folder-chips">
          {folders.data.map((f) => (
            <span key={f} className="folder-chip" title={f}>
              <span className="ellipsis">{f}</span>
              <button aria-label={`Remove ${f}`} onClick={async () => refresh(await window.aurora.removeLocalFolder(f))}>
                <CloseIcon size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="detail-tracks">
        {q.isPending || q.isFetching ? (
          <RowsSkeleton />
        ) : !songs.length ? (
          <MessageState message="Add a folder to play music files from this computer: MP3, AAC, FLAC, Opus, WAV and more." />
        ) : (
          songs.map((song, i) => (
            <SongRow key={song.videoId} song={song} onPlay={() => usePlayer.getState().playSongs(songs, i, { source: 'Local Music' })} />
          ))
        )}
      </div>
    </PageScroll>
  )
}
