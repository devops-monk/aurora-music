import type { Song } from '@shared/models'

/**
 * Pure queue operations, kept apart from the store so they can be tested
 * without a player (BitChord's `QueueBuilder.kt` / `QueueShuffle.kt`).
 */

export interface Queue {
  songs: Song[]
  index: number
}

/** Fisher–Yates over everything but the current track, which stays first. */
export function shuffled(queue: Queue, random: () => number = Math.random): Queue {
  if (queue.songs.length < 2) return queue
  const current = queue.songs[queue.index]
  const rest = queue.songs.filter((_, i) => i !== queue.index)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  return { songs: [current, ...rest], index: 0 }
}

/** Back to the original order, keeping the current track current. */
export function unshuffled(queue: Queue, original: Song[]): Queue {
  const current = queue.songs[queue.index]
  const index = original.findIndex((s) => s.videoId === current?.videoId)
  // Anything added while shuffled that the original never had goes on the end.
  const extra = queue.songs.filter((s) => !original.some((o) => o.videoId === s.videoId))
  const songs = [...original, ...extra]
  return { songs, index: index >= 0 ? index : Math.min(queue.index, songs.length - 1) }
}

export function insertNext(queue: Queue, song: Song): Queue {
  const songs = [...queue.songs]
  songs.splice(queue.index + 1, 0, song)
  return { songs, index: queue.index }
}

export function removeAt(queue: Queue, at: number): Queue {
  if (at === queue.index || at < 0 || at >= queue.songs.length) return queue
  const songs = queue.songs.filter((_, i) => i !== at)
  return { songs, index: at < queue.index ? queue.index - 1 : queue.index }
}

export function move(queue: Queue, from: number, to: number): Queue {
  if (from === to || from < 0 || to < 0 || from >= queue.songs.length || to >= queue.songs.length) return queue
  const songs = [...queue.songs]
  const [item] = songs.splice(from, 1)
  songs.splice(to, 0, item)
  let index = queue.index
  if (from === queue.index) index = to
  else if (from < queue.index && to >= queue.index) index--
  else if (from > queue.index && to <= queue.index) index++
  return { songs, index }
}

/** Radio results appended without repeating anything already queued. */
export function appendUnique(queue: Queue, more: Song[]): Queue {
  const seen = new Set(queue.songs.map((s) => s.videoId))
  const fresh = more.filter((s) => !seen.has(s.videoId) && (seen.add(s.videoId), true))
  return fresh.length ? { songs: [...queue.songs, ...fresh], index: queue.index } : queue
}
