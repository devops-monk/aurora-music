import { app, BrowserWindow } from 'electron'
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { DownloadEntry, Song } from '@shared/models'
import { artworkAt, PLAYER_ART_PX } from '@shared/models'
import { resolveStream } from './ytm/stream'

/**
 * Offline downloads, the desktop `Downloads.kt`: the resolved stream saved
 * whole to ~/Music/Aurora Music, its cover beside it, and an index that
 * carries the metadata. Once a track is here the stream protocol plays the file
 * instead of the network, so a downloaded song keeps working offline, in any
 * queue, with no special casing in the player.
 */

const CHUNK = 4 * 1024 * 1024

let entries = new Map<string, DownloadEntry>()
let loaded = false
const active = new Map<string, AbortController>()

const dir = () => {
  const d = join(app.getPath('music'), 'Aurora Music')
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}
const indexFile = () => join(app.getPath('userData'), 'downloads.json')

function load() {
  if (loaded) return
  loaded = true
  try {
    const list = JSON.parse(readFileSync(indexFile(), 'utf8')) as DownloadEntry[]
    entries = new Map(list.filter((e) => e.state === 'done' && existsSync(e.path)).map((e) => [e.song.videoId, e]))
  } catch {
    entries = new Map()
  }
}

function persist() {
  writeFileSync(indexFile(), JSON.stringify([...entries.values()].filter((e) => e.state === 'done')))
}

function broadcast() {
  const list = downloads()
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('aurora:downloads', list)
}

const safe = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120)

export function downloads(): DownloadEntry[] {
  load()
  return [...entries.values()].sort((a, b) => b.addedAt - a.addedAt)
}

export function downloadedPath(videoId: string): { path: string; mimeType: string } | null {
  load()
  const e = entries.get(videoId)
  return e?.state === 'done' && existsSync(e.path) ? { path: e.path, mimeType: e.mimeType } : null
}

export async function download(song: Song): Promise<void> {
  load()
  const existing = entries.get(song.videoId)
  if (existing && existing.state !== 'error') return
  const entry: DownloadEntry = { song, state: 'downloading', progress: 0, path: '', mimeType: '', addedAt: Date.now() }
  entries.set(song.videoId, entry)
  broadcast()
  const controller = new AbortController()
  active.set(song.videoId, controller)
  try {
    const stream = await resolveStream(song.videoId)
    const ext = stream.mimeType.includes('webm') ? 'webm' : 'm4a'
    const base = safe(`${song.artist} - ${song.title}`) || song.videoId
    const path = join(dir(), `${base} [${song.videoId}].${ext}`)
    const tmp = path + '.part'
    const total = await contentLength(stream.url, controller.signal)
    const out = createWriteStream(tmp)
    // googlevideo serves large ranges more reliably in pieces than as one request.
    for (let start = 0; start < total; start += CHUNK) {
      const end = Math.min(total, start + CHUNK) - 1
      const res = await fetch(stream.url, { headers: { Range: `bytes=${start}-${end}` }, signal: controller.signal })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
      await pipeline(Readable.fromWeb(res.body as never), out, { end: false })
      entry.progress = (end + 1) / total
      broadcast()
    }
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())))
    renameSync(tmp, path)
    const cover = artworkAt(song.thumbnailUrl, PLAYER_ART_PX)
    if (cover) {
      try {
        const art = await fetch(cover, { signal: controller.signal })
        if (art.ok) writeFileSync(path.replace(/\.[^.]+$/, '.jpg'), Buffer.from(await art.arrayBuffer()))
      } catch {
        /* the cover is optional */
      }
    }
    Object.assign(entry, { state: 'done', progress: 1, path, mimeType: stream.mimeType.split(';')[0] })
    persist()
  } catch (e) {
    if (controller.signal.aborted) entries.delete(song.videoId)
    else Object.assign(entry, { state: 'error', error: (e as Error).message })
  } finally {
    active.delete(song.videoId)
    broadcast()
  }
}

async function contentLength(url: string, signal: AbortSignal): Promise<number> {
  const clen = Number(new URL(url).searchParams.get('clen'))
  if (clen > 0) return clen
  const res = await fetch(url, { headers: { Range: 'bytes=0-0' }, signal })
  const total = Number(res.headers.get('content-range')?.split('/')[1])
  await res.body?.cancel()
  if (!total) throw new Error('Unknown size')
  return total
}

export function removeDownload(videoId: string) {
  load()
  active.get(videoId)?.abort()
  const e = entries.get(videoId)
  if (e?.path) {
    for (const p of [e.path, e.path.replace(/\.[^.]+$/, '.jpg')]) {
      try {
        unlinkSync(p)
      } catch {
        /* already gone */
      }
    }
  }
  entries.delete(videoId)
  persist()
  broadcast()
}
