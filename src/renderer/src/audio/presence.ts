import { usePlayer } from '../store/player'
import { getPositionMs } from './engine'

/**
 * Keeps Discord's status in step with playback: a new track, play/pause, or a
 * seek (the progress bar is timestamps, so only a jump needs resending).
 */

let lastKey = ''
let lastPos = 0
let lastAt = 0

function publish(force = false) {
  const s = usePlayer.getState()
  const song = s.current()
  const pos = getPositionMs()
  const key = `${song?.videoId}|${s.isPlaying}|${Math.round(s.durationMs / 1000)}`
  // Expected position if nothing was seeked since the last send.
  const drift = Math.abs(pos - (lastPos + (s.isPlaying ? Date.now() - lastAt : 0)))
  if (!force && key === lastKey && drift < 2500) return
  lastKey = key
  lastPos = pos
  lastAt = Date.now()
  window.aurora
    .updatePresence(song ? { song, positionMs: pos, durationMs: s.durationMs, playing: s.isPlaying } : null)
    .catch(() => undefined)
}

usePlayer.subscribe((s, prev) => {
  if (s.index !== prev.index || s.songs !== prev.songs || s.isPlaying !== prev.isPlaying || s.durationMs !== prev.durationMs) publish()
})
setInterval(() => publish(), 3000)
