import { protocol } from 'electron'
import { createReadStream, statSync } from 'node:fs'
import { extname } from 'node:path'
import { Readable } from 'node:stream'
import { STREAM_SCHEME } from '@shared/api'
import { isLocalId } from '@shared/models'
import { invalidateStream, resolveStream } from './ytm/stream'
import { downloadedPath } from './downloads'
import { localArt, localPath } from './local'

/**
 * `aurora://stream/<videoId>`: what the renderer's <audio> element plays.
 *
 * The renderer never sees a googlevideo URL. Chromium's media stack issues
 * ordinary Range requests against this scheme, and they are forwarded to the
 * resolved URL here, which keeps URL expiry, PO tokens and retries in one
 * place, the ExoPlayer DataSource role on Android.
 */

export function registerSchemePrivileges() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: STREAM_SCHEME,
      privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true },
    },
  ])
}

const FORWARDED = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']

async function forward(videoId: string, range: string | null, retry = true): Promise<Response> {
  const stream = await resolveStream(videoId)
  const upstream = await fetch(stream.url, { headers: range ? { Range: range } : {} })
  if ((upstream.status === 403 || upstream.status === 410) && retry) {
    // Expired or revoked URL: resolve again and replay the same range once.
    await upstream.body?.cancel()
    invalidateStream(videoId)
    return forward(videoId, range, false)
  }
  const headers = new Headers()
  for (const name of FORWARDED) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  headers.set('accept-ranges', 'bytes')
  // The renderer's <audio> is crossOrigin="anonymous" so Web Audio can process it.
  headers.set('access-control-allow-origin', '*')
  headers.set('content-type', stream.mimeType.split(';')[0])
  return new Response(upstream.body, { status: upstream.status, headers })
}

const MIME_BY_EXT: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.alac': 'audio/mp4',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
  '.aiff': 'audio/aiff',
  '.aif': 'audio/aiff',
}

/** A file on disk as a Range-aware response, the way Chromium's media stack expects. */
function serveFile(path: string, range: string | null, mimeType?: string): Response {
  const size = statSync(path).size
  const type = mimeType || MIME_BY_EXT[extname(path).toLowerCase()] || 'application/octet-stream'
  const headers = new Headers({ 'content-type': type, 'accept-ranges': 'bytes', 'access-control-allow-origin': '*' })
  const m = range && /bytes=(\d*)-(\d*)/.exec(range)
  if (!m) {
    headers.set('content-length', String(size))
    return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream, { status: 200, headers })
  }
  let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]))
  let end = m[1] && m[2] ? Number(m[2]) : size - 1
  end = Math.min(end, size - 1)
  if (start > end) {
    headers.set('content-range', `bytes */${size}`)
    return new Response(null, { status: 416, headers })
  }
  start = Math.max(0, start)
  headers.set('content-range', `bytes ${start}-${end}/${size}`)
  headers.set('content-length', String(end - start + 1))
  return new Response(Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream, { status: 206, headers })
}

export function handleStreamProtocol() {
  protocol.handle(STREAM_SCHEME, async (request) => {
    const url = new URL(request.url)
    const id = decodeURIComponent(url.pathname.replace(/^\//, ''))
    if (url.hostname === 'art') {
      const art = isLocalId(id) ? await localArt(id) : null
      if (!art) return new Response('Not found', { status: 404 })
      return new Response(Buffer.from(art.data), { headers: { 'content-type': art.format, 'access-control-allow-origin': '*' } })
    }
    if (url.hostname !== 'stream') return new Response('Not found', { status: 404 })
    const range = request.headers.get('range')
    if (isLocalId(id)) {
      const path = localPath(id)
      return path ? serveFile(path, range) : new Response('Missing file', { status: 404 })
    }
    const videoId = id
    if (!/^[\w-]{6,20}$/.test(videoId)) return new Response('Bad id', { status: 400 })
    // A downloaded track plays from disk, online or not.
    const saved = downloadedPath(videoId)
    if (saved) return serveFile(saved.path, range, saved.mimeType)
    try {
      return await forward(videoId, range)
    } catch (e) {
      console.error('[stream] failed', videoId, (e as Error).message)
      return new Response((e as Error).message, { status: 502 })
    }
  })
}
