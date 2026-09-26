import type { Lyrics, Song } from '@shared/models'
import { cleanQuery, parseLrc, parseTtml, plainLines } from '@shared/lyrics'
import { getSettings } from './store'
import { youtubeLyrics } from './ytm/client'

/**
 * Lyrics, tried source by source in the order Settings gives, first synced hit
 * wins (BitChord's `LyricsRepository.kt`, trimmed to the three MVP sources).
 * An unsynced result is kept only as a last resort.
 */

const AGENT = 'Aurora Music (https://github.com/devops-monk/aurora-music)'
const TIMEOUT_MS = 8000

async function get(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    return res.ok ? await res.text() : null
  } catch {
    return null
  }
}

async function betterLyrics(song: Song, durationMs: number): Promise<Lyrics | null> {
  const q = new URLSearchParams({ s: cleanQuery(song.title), a: song.artist.split(',')[0].trim() })
  if (durationMs > 0) q.set('d', String(Math.round(durationMs / 1000)))
  if (song.albumName) q.set('al', song.albumName)
  const body = await get(`https://lyrics-api.boidu.dev/getLyrics?${q}`)
  if (!body) return null
  let ttml: string | undefined
  try {
    ttml = JSON.parse(body).ttml
  } catch {
    return null
  }
  if (!ttml) return null
  const lines = parseTtml(ttml)
  return lines.some((l) => l.text) ? { source: 'BetterLyrics', synced: true, lines } : null
}

async function lrclib(song: Song, durationMs: number): Promise<Lyrics | null> {
  const title = cleanQuery(song.title)
  const artist = cleanQuery(song.artist.split(',')[0])
  const seconds = Math.round(durationMs / 1000)
  let synced: string | null = null
  const exact = await get(
    `https://lrclib.net/api/get?${new URLSearchParams({ track_name: title, artist_name: artist, duration: String(seconds) })}`,
  )
  try {
    synced = exact ? JSON.parse(exact).syncedLyrics : null
  } catch {
    /* fall through to search */
  }
  if (!synced) {
    const hits = await get(`https://lrclib.net/api/search?${new URLSearchParams({ track_name: title, artist_name: artist })}`)
    try {
      const list = (hits ? JSON.parse(hits) : []) as { syncedLyrics?: string; duration?: number }[]
      synced =
        list
          .filter((h) => h.syncedLyrics?.trim())
          .sort((a, b) => Math.abs((a.duration ?? 0) - seconds) - Math.abs((b.duration ?? 0) - seconds))[0]
          ?.syncedLyrics ?? null
    } catch {
      synced = null
    }
  }
  if (!synced) return null
  const lines = parseLrc(synced)
  return lines.length ? { source: 'LRCLIB', synced: true, lines } : null
}

async function youtube(song: Song): Promise<Lyrics | null> {
  const text = await youtubeLyrics(song.videoId)
  return text ? { source: 'YouTube Music', synced: false, lines: plainLines(text) } : null
}

const cache = new Map<string, Lyrics | null>()

export async function lyricsFor(song: Song, durationMs: number): Promise<Lyrics | null> {
  if (cache.has(song.videoId)) return cache.get(song.videoId) ?? null
  let fallback: Lyrics | null = null
  let found: Lyrics | null = null
  for (const source of getSettings().lyricsSources) {
    const result =
      source === 'betterlyrics'
        ? await betterLyrics(song, durationMs)
        : source === 'lrclib'
          ? await lrclib(song, durationMs)
          : await youtube(song)
    if (result?.synced) {
      found = result
      break
    }
    fallback ??= result
  }
  const answer = found ?? fallback
  if (cache.size > 100) cache.clear()
  cache.set(song.videoId, answer)
  return answer
}
