import { Reorder } from 'framer-motion'
import { ROW_ART_PX, type Song } from '@shared/models'
import { usePlayer } from '../store/player'
import { Artwork } from '../components/Common'
import { CloseIcon, InfinityIcon, RepeatIcon, ShuffleIcon } from '../components/Icons'
import { openSongMenu } from '../lib/actions'

/**
 * `PlayerQueue.kt`: what plays next, drag to reorder, × to remove, with the
 * shuffle / repeat / autoplay toggles in the header.
 */
export function QueuePane() {
  const songs = usePlayer((s) => s.songs)
  const index = usePlayer((s) => s.index)
  const shuffle = usePlayer((s) => !!s.original)
  const repeat = usePlayer((s) => s.repeat)
  const source = usePlayer((s) => s.source)
  const radio = usePlayer((s) => s.radio)
  // The Song objects themselves are the values: Reorder tracks items by reference.
  const upcoming = songs.slice(index + 1)

  return (
    <div className="queue-pane">
      <div className="queue-header">
        <div>
          <div className="queue-title">Playing Next</div>
          {source && <div className="queue-subtitle">From {source}</div>}
        </div>
        <div className="queue-toggles">
          <button
            className={`queue-toggle ${shuffle ? 'is-active' : ''}`}
            aria-label="Shuffle"
            onClick={() => usePlayer.getState().toggleShuffle()}
          >
            <ShuffleIcon size={18} />
          </button>
          <button
            className={`queue-toggle ${repeat !== 'off' ? 'is-active' : ''}`}
            aria-label={`Repeat ${repeat}`}
            onClick={() => usePlayer.getState().cycleRepeat()}
          >
            <RepeatIcon size={18} one={repeat === 'one'} />
          </button>
          <button className={`queue-toggle ${radio ? 'is-active' : ''}`} aria-label="Autoplay" title="Autoplay" disabled>
            <InfinityIcon size={18} />
          </button>
        </div>
      </div>
      <Reorder.Group
        axis="y"
        className="queue-list"
        values={upcoming}
        onReorder={(next) => usePlayer.getState().reorderUpcoming(next)}
      >
        {upcoming.map((song, i) => (
          <Reorder.Item key={song.videoId} value={song} className="queue-row" whileDrag={{ scale: 1.02 }}>
            <QueueRow song={song} at={index + 1 + i} />
          </Reorder.Item>
        ))}
      </Reorder.Group>
      {!upcoming.length && <div className="queue-empty">Nothing queued. Autoplay will pick something.</div>}
    </div>
  )
}

function QueueRow({ song, at }: { song: Song; at: number }) {
  return (
    <div
      className="queue-row-inner"
      onDoubleClick={() => usePlayer.getState().jumpTo(at)}
      onContextMenu={(e) => {
        e.preventDefault()
        openSongMenu(song, { x: e.clientX, y: e.clientY })
      }}
    >
      <Artwork url={song.thumbnailUrl} px={ROW_ART_PX} radius={6} className="queue-art" />
      <div className="queue-text" onClick={() => usePlayer.getState().jumpTo(at)}>
        <div className="queue-song ellipsis">{song.title}</div>
        <div className="queue-artist ellipsis">{song.artist}</div>
      </div>
      <button className="queue-remove" aria-label="Remove" onClick={() => usePlayer.getState().removeAt(at)}>
        <CloseIcon size={16} />
      </button>
    </div>
  )
}
