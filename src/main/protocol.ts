import { protocol } from 'electron'
import { STREAM_SCHEME } from '@shared/api'
import { invalidateStream, resolveStream } from './ytm/stream'

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

export function handleStreamProtocol() {
  protocol.handle(STREAM_SCHEME, async (request) => {
    const url = new URL(request.url)
    if (url.hostname !== 'stream') return new Response('Not found', { status: 404 })
    const videoId = decodeURIComponent(url.pathname.replace(/^\//, ''))
    if (!/^[\w-]{6,20}$/.test(videoId)) return new Response('Bad id', { status: 400 })
    try {
      return await forward(videoId, request.headers.get('range'))
    } catch (e) {
      console.error('[stream] failed', videoId, (e as Error).message)
      return new Response((e as Error).message, { status: 502 })
    }
  })
}
