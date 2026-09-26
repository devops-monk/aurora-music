import type { ShelfItem, Song } from '@shared/models'
import { usePlayer } from '../store/player'
import { useUi } from '../store/ui'
import { HeartIcon, LibraryIcon, PersonIcon, PlayNextIcon, PlusIcon, RadioIcon, ShareIcon } from '../components/Icons'

/** What a tap on a card or suggestion does: play it, or open its page. */
export function openItem(item: ShelfItem, source?: string) {
  if (item.song || item.videoId) {
    const song: Song = item.song ?? {
      videoId: item.videoId!,
      title: item.title,
      artist: item.subtitle,
      thumbnailUrl: item.thumbnailUrl,
    }
    usePlayer.getState().playRadio(song, source ?? null)
    return
  }
  if (item.browseId) useUi.getState().push({ kind: 'detail', browseId: item.browseId, title: item.title })
}

export async function toggleLike(song: Song) {
  const { liked, setLiked } = usePlayer.getState()
  const next = !liked[song.videoId]
  setLiked(song.videoId, next)
  if (!useUi.getState().account) {
    useUi.getState().showToast('Sign in to save songs to your library')
    return
  }
  try {
    await window.aurora.like(song.videoId, next)
    useUi.getState().showToast(next ? 'Added to Liked Music' : 'Removed from Liked Music')
  } catch {
    setLiked(song.videoId, !next)
    useUi.getState().showToast('Could not update Liked Music')
  }
}

/** The long-press sheet (`SongActionsSheet.kt`) as a desktop context menu. */
export function openSongMenu(song: Song, at: { x: number; y: number }) {
  const player = usePlayer.getState()
  const ui = useUi.getState()
  const liked = player.liked[song.videoId]
  const items = [
    {
      label: 'Play Next',
      icon: <PlayNextIcon size={18} />,
      onSelect: () => {
        usePlayer.getState().playNext(song)
        useUi.getState().showToast('Playing next')
      },
    },
    {
      label: 'Add to Queue',
      icon: <PlusIcon size={18} />,
      onSelect: () => {
        usePlayer.getState().addToQueue(song)
        useUi.getState().showToast('Added to queue')
      },
    },
    { label: 'Start Radio', icon: <RadioIcon size={18} />, onSelect: () => usePlayer.getState().playRadio(song, 'Radio') },
    { label: liked ? 'Remove from Liked' : 'Like', icon: <HeartIcon size={18} filled={liked} />, onSelect: () => toggleLike(song) },
  ]
  if (song.albumId)
    items.push({
      label: 'Go to Album',
      icon: <LibraryIcon size={18} />,
      onSelect: () => {
        usePlayer.getState().closeNowPlaying()
        useUi.getState().push({ kind: 'detail', browseId: song.albumId!, title: song.albumName ?? undefined })
      },
    })
  if (song.artistId)
    items.push({
      label: 'Go to Artist',
      icon: <PersonIcon size={18} />,
      onSelect: () => {
        usePlayer.getState().closeNowPlaying()
        useUi.getState().push({ kind: 'detail', browseId: song.artistId!, title: song.artist })
      },
    })
  items.push({
    label: 'Copy Link',
    icon: <ShareIcon size={18} />,
    onSelect: () => {
      navigator.clipboard.writeText(`https://music.youtube.com/watch?v=${song.videoId}`)
      useUi.getState().showToast('Link copied')
    },
  })
  ui.openMenu({ x: at.x, y: at.y, items })
}

export function openItemMenu(item: ShelfItem, at: { x: number; y: number }) {
  if (item.song) return openSongMenu(item.song, at)
  if (!item.browseId) return
  useUi.getState().openMenu({
    x: at.x,
    y: at.y,
    items: [
      { label: 'Open', onSelect: () => openItem(item) },
      {
        label: 'Copy Link',
        icon: <ShareIcon size={18} />,
        onSelect: () => {
          const id = item.browseId!
          const url =
            item.type === 'artist'
              ? `https://music.youtube.com/channel/${id}`
              : item.type === 'playlist'
                ? `https://music.youtube.com/playlist?list=${id.replace(/^VL/, '')}`
                : `https://music.youtube.com/browse/${id}`
          navigator.clipboard.writeText(url)
          useUi.getState().showToast('Link copied')
        },
      },
    ],
  })
}
