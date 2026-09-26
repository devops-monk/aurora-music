import { app, BrowserWindow, dialog } from 'electron'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PlayRecord, ReplayMonth, ReplayRank } from '@shared/api'
import type { Song } from '@shared/models'

/**
 * Replay: every real play, counted on this computer (BitChord's
 * `ListeningStats.kt`). A play is appended as one JSON line when a track stops
 * being the current one, with how long it was actually heard; the monthly
 * recap is computed from that log on demand. Nothing leaves the machine.
 */

/** Shorter listens are skips, not plays. */
const MIN_PLAY_MS = 30_000
const TOP = 10

const logFile = () => join(app.getPath('userData'), 'plays.jsonl')

export function recordPlay(play: PlayRecord) {
  if (play.ms < MIN_PLAY_MS || !play.song?.videoId) return
  const { song } = play
  const row = {
    t: play.startedAt,
    ms: Math.round(play.ms),
    id: song.videoId,
    title: song.title,
    artist: song.artist,
    artistId: song.artistId ?? null,
    album: song.albumName ?? null,
    albumId: song.albumId ?? null,
    thumb: song.thumbnailUrl ?? null,
  }
  appendFileSync(logFile(), JSON.stringify(row) + '\n')
}

interface Row {
  t: number
  ms: number
  id: string
  title: string
  artist: string
  artistId: string | null
  album: string | null
  albumId: string | null
  thumb: string | null
}

function readRows(): Row[] {
  if (!existsSync(logFile())) return []
  const rows: Row[] = []
  for (const line of readFileSync(logFile(), 'utf8').split('\n')) {
    if (!line) continue
    try {
      rows.push(JSON.parse(line))
    } catch {
      /* a torn last line after a crash; skip it */
    }
  }
  return rows
}

const monthKey = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** The first credited artist, so features don't split an artist's count. */
const primary = (artist: string) => artist.split(/\s*(?:,|&|\bfeat\.?|\bft\.?)\s*/i)[0]?.trim() || artist

function rank<K>(rows: Row[], keyOf: (r: Row) => K | null, make: (r: Row) => Omit<ReplayRank, 'plays' | 'minutes'>): ReplayRank[] {
  const map = new Map<K, ReplayRank>()
  for (const r of rows) {
    const key = keyOf(r)
    if (key === null || key === '') continue
    const entry = map.get(key) ?? { ...make(r), plays: 0, minutes: 0 }
    entry.plays++
    entry.minutes += r.ms / 60_000
    map.set(key, entry)
  }
  return [...map.values()]
    .sort((a, b) => b.minutes - a.minutes || b.plays - a.plays)
    .slice(0, TOP)
    .map((e) => ({ ...e, minutes: Math.round(e.minutes) }))
}

export function replayMonths(): string[] {
  return [...new Set(readRows().map((r) => monthKey(r.t)))].sort().reverse()
}

export function replay(month?: string): ReplayMonth {
  const all = readRows()
  const key = month ?? monthKey(Date.now())
  const rows = all.filter((r) => monthKey(r.t) === key)
  const [y, m] = key.split('-').map(Number)
  const days = new Date(y, m, 0).getDate()
  const perDay = Array.from({ length: days }, () => 0)
  for (const r of rows) perDay[new Date(r.t).getDate() - 1] += r.ms / 60_000
  const song = (r: Row): Song => ({
    videoId: r.id,
    title: r.title,
    artist: r.artist,
    artistId: r.artistId,
    albumName: r.album,
    albumId: r.albumId,
    thumbnailUrl: r.thumb,
  })
  return {
    month: key,
    minutes: Math.round(rows.reduce((s, r) => s + r.ms, 0) / 60_000),
    plays: rows.length,
    distinctSongs: new Set(rows.map((r) => r.id)).size,
    distinctArtists: new Set(rows.map((r) => primary(r.artist))).size,
    memberSince: all.length ? Math.min(...all.map((r) => r.t)) : null,
    perDayMinutes: perDay.map((v) => Math.round(v)),
    topSongs: rank(rows, (r) => r.id, (r) => ({ key: r.id, title: r.title, subtitle: r.artist, thumbnailUrl: r.thumb, song: song(r) })),
    topArtists: rank(rows, (r) => primary(r.artist), (r) => ({ key: primary(r.artist), title: primary(r.artist), subtitle: '', thumbnailUrl: r.thumb, browseId: r.artistId })),
    topAlbums: rank(
      rows,
      (r) => r.albumId ?? r.album,
      (r) => ({ key: r.albumId ?? r.album ?? '', title: r.album ?? '', subtitle: primary(r.artist), thumbnailUrl: r.thumb, browseId: r.albumId }),
    ),
  }
}

/** Saves a rendered poster (PNG data URL) where the user chooses. */
export async function savePoster(win: BrowserWindow | null, dataUrl: string, month: string): Promise<boolean> {
  const opts = {
    title: 'Save Replay poster',
    defaultPath: join(app.getPath('pictures'), `Aurora Replay ${month}.png`),
    filters: [{ name: 'PNG image', extensions: ['png'] }],
  }
  const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
  if (res.canceled || !res.filePath) return false
  writeFileSync(res.filePath, Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'))
  return true
}
