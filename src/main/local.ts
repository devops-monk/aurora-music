import { app } from 'electron'
import { createHash } from 'node:crypto'
import { readdir, stat } from 'node:fs/promises'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join, basename, dirname } from 'node:path'
import { parseFile } from 'music-metadata'
import type { Song } from '@shared/models'
import { formatTime } from '@shared/models'
import { getSettings } from './store'

/**
 * Music files on disk, the desktop `LocalMediaRepository.kt`: every folder the
 * user adds is walked for audio, each file's tags read once and cached by
 * modification time, so a rescan only re-reads what changed.
 *
 * A local track is a Song whose videoId is `local:<hash of its path>`; the
 * stream protocol serves those from disk and the art protocol serves the
 * embedded cover, so the player and every list treat them like any other song.
 */

export const LOCAL_PREFIX = 'local:'
const AUDIO_EXT = new Set(['.mp3', '.m4a', '.aac', '.flac', '.ogg', '.opus', '.wav', '.webm', '.alac', '.aiff', '.aif'])
const MAX_DEPTH = 8

interface Entry {
  path: string
  mtimeMs: number
  song: Song
  hasArt: boolean
}

let index = new Map<string, Entry>()
let loaded = false
let scanning: Promise<Song[]> | null = null

const indexFile = () => join(app.getPath('userData'), 'local-index.v2.json')
export const localId = (path: string) => LOCAL_PREFIX + createHash('sha1').update(path).digest('hex').slice(0, 20)

function load() {
  if (loaded) return
  loaded = true
  try {
    const entries = JSON.parse(readFileSync(indexFile(), 'utf8')) as Entry[]
    index = new Map(entries.map((e) => [e.song.videoId, e]))
  } catch {
    index = new Map()
  }
}

function save() {
  writeFileSync(indexFile(), JSON.stringify([...index.values()]))
}

async function walk(dir: string, depth: number, out: string[]) {
  if (depth > MAX_DEPTH) return
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) await walk(full, depth + 1, out)
    else if (e.isFile() && AUDIO_EXT.has(extname(e.name).toLowerCase())) out.push(full)
  }
}

/** "Artist - Title [videoId]" (how downloads are named) or "Artist - Title". */
function fromFileName(path: string): { title: string; artist: string } {
  const name = basename(path, extname(path)).replace(/\s*\[[\w-]{11}\]$/, '')
  const dash = name.indexOf(' - ')
  return dash > 0 ? { artist: name.slice(0, dash).trim(), title: name.slice(dash + 3).trim() } : { artist: 'Unknown Artist', title: name }
}

/** A cover beside the file: its own name as .jpg/.png, else the folder's cover/folder image. */
function sidecarArt(path: string): string | null {
  const stem = path.slice(0, -extname(path).length)
  const dir = dirname(path)
  const candidates = [`${stem}.jpg`, `${stem}.png`, ...['cover', 'folder', 'Cover', 'Folder'].flatMap((n) => [join(dir, `${n}.jpg`), join(dir, `${n}.png`)])]
  return candidates.find((c) => existsSync(c)) ?? null
}

async function readEntry(path: string, mtimeMs: number): Promise<Entry> {
  const id = localId(path)
  const named = fromFileName(path)
  let song: Song = {
    videoId: id,
    title: named.title,
    artist: named.artist,
    thumbnailUrl: null,
  }
  let hasArt = false
  try {
    const meta = await parseFile(path, { duration: true, skipCovers: false })
    const c = meta.common
    hasArt = !!c.picture?.length || !!sidecarArt(path)
    song = {
      videoId: id,
      title: c.title || song.title,
      artist: c.artists?.join(', ') || c.artist || c.albumartist || song.artist,
      albumName: c.album ?? null,
      durationText: meta.format.duration ? formatTime(meta.format.duration * 1000) : null,
      thumbnailUrl: hasArt ? `aurora://art/${encodeURIComponent(id)}` : null,
    }
  } catch {
    /* unreadable: keep what the file name says */
    hasArt = !!sidecarArt(path)
    if (hasArt) song.thumbnailUrl = `aurora://art/${encodeURIComponent(id)}`
  }
  return { path, mtimeMs, song, hasArt }
}

async function scan(): Promise<Song[]> {
  load()
  const files: string[] = []
  for (const folder of getSettings().localFolders) await walk(folder, 0, files)
  const next = new Map<string, Entry>()
  for (const path of files) {
    const id = localId(path)
    let mtimeMs = 0
    try {
      mtimeMs = (await stat(path)).mtimeMs
    } catch {
      continue
    }
    const known = index.get(id)
    next.set(id, known && known.mtimeMs === mtimeMs ? known : await readEntry(path, mtimeMs))
  }
  index = next
  save()
  return songs()
}

function songs(): Song[] {
  return [...index.values()]
    .map((e) => e.song)
    .sort((a, b) => a.artist.localeCompare(b.artist) || (a.albumName ?? '').localeCompare(b.albumName ?? '') || a.title.localeCompare(b.title))
}

/** The indexed library, scanning first if it has never been scanned. */
export async function localSongs(rescan = false): Promise<Song[]> {
  load()
  if (!rescan && index.size) return songs()
  scanning ??= scan().finally(() => (scanning = null))
  return scanning
}

export function localPath(id: string): string | null {
  load()
  const p = index.get(id)?.path
  return p && existsSync(p) ? p : null
}

/** The embedded cover of a local track. */
export async function localArt(id: string): Promise<{ data: Uint8Array; format: string } | null> {
  const path = localPath(id)
  if (!path) return null
  try {
    const pic = (await parseFile(path, { skipPostHeaders: true })).common.picture?.[0]
    if (pic) return { data: pic.data, format: pic.format }
  } catch {
    /* fall through to a sidecar image */
  }
  const side = sidecarArt(path)
  return side ? { data: readFileSync(side), format: side.endsWith('.png') ? 'image/png' : 'image/jpeg' } : null
}
