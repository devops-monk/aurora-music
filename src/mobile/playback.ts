import { artworkAt, PLAYER_ART_PX } from '@shared/models'
import { usePlayer } from '@renderer/store/player'
import { next, previous, seekTo, togglePlay } from '@renderer/audio/engine'
import { Playback } from './native'

/**
 * Keeps Android's media notification (and with it the foreground service that
 * lets music play with the screen off) in step with the player, and routes
 * its buttons back to the engine.
 */

let lastKey = ''

function sync() {
  const s = usePlayer.getState()
  const song = s.current()
  if (!song) {
    if (lastKey) Playback.stop()
    lastKey = ''
    return
  }
  const key = [song.videoId, s.isPlaying, Math.round(s.durationMs / 1000)].join('|')
  if (key === lastKey) return
  lastKey = key
  Playback.update({
    title: song.title,
    artist: song.artist,
    album: song.albumName ?? null,
    artworkUrl: artworkAt(song.thumbnailUrl, PLAYER_ART_PX),
    playing: s.isPlaying,
    positionMs: s.positionMs,
    durationMs: s.durationMs,
  }).catch(() => undefined)
}

usePlayer.subscribe(sync)
sync()

Playback.addListener('action', ({ action, positionMs }) => {
  const playing = usePlayer.getState().isPlaying
  if (action === 'play' && !playing) togglePlay()
  else if (action === 'pause' && playing) togglePlay()
  else if (action === 'next') next()
  else if (action === 'previous') previous()
  else if (action === 'seek' && positionMs != null) seekTo(positionMs)
  else if (action === 'stop' && playing) togglePlay()
})
