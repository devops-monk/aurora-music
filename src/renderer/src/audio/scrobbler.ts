import type { Song } from '@shared/models'
import { usePlayer } from '../store/player'
import { getPositionMs } from './engine'

/**
 * When a play counts, `ScrobbleManager.kt`'s rule: a track longer than 30 s
 * scrobbles once it has actually been *heard* for half its length or four
 * minutes, whichever is sooner. Listening time is measured from the playhead
 * advancing while playing, so seeking ahead does not count as listening.
 */

const MIN_TRACK_MS = 30_000
const MAX_THRESHOLD_MS = 240_000
const TICK_MS = 1000

export function shouldScrobble(listenedMs: number, durationMs: number): boolean {
  if (durationMs <= MIN_TRACK_MS) return false
  return listenedMs >= Math.min(durationMs / 2, MAX_THRESHOLD_MS)
}

let current: { song: Song; startedAt: number; listened: number; lastPos: number; done: boolean; announced: boolean } | null = null

/** Replay: the time actually heard is recorded as one play when a track stops being current. */
function flush() {
  if (current && current.listened > 0) {
    window.aurora.recordPlay({ song: current.song, startedAt: current.startedAt, ms: current.listened }).catch(() => undefined)
  }
}

function begin(song: Song) {
  flush()
  current = { song, startedAt: Date.now(), listened: 0, lastPos: getPositionMs(), done: false, announced: false }
}

if (typeof window !== 'undefined') window.addEventListener('beforeunload', flush)

if (typeof window !== 'undefined') setInterval(() => {
  const s = usePlayer.getState()
  const song = s.current()
  if (!song) return
  if (!current || current.song.videoId !== song.videoId) begin(song)
  const c = current!
  const pos = getPositionMs()
  const delta = pos - c.lastPos
  c.lastPos = pos
  // Only small forward steps are listening; a jump is a seek, and backwards is a restart.
  if (s.isPlaying && delta > 0 && delta < TICK_MS * 3) c.listened += delta
  if (pos < 1000 && c.listened > 0 && c.done) begin(song) // repeat-one / replay counts again
  if (s.isPlaying && !c.announced && s.durationMs > 0) {
    c.announced = true
    window.aurora.nowPlaying(song, s.durationMs).catch(() => undefined)
  }
  if (!c.done && shouldScrobble(c.listened, s.durationMs)) {
    c.done = true
    window.aurora.scrobble(song, c.startedAt, s.durationMs).catch(() => undefined)
  }
}, TICK_MS)
