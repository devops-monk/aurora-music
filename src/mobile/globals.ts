import { Buffer } from 'buffer'
import { CapacitorHttp } from '@capacitor/core'

// The shared main modules use Node's Buffer for base64; the WebView has none.
;(globalThis as { Buffer?: typeof Buffer }).Buffer ??= Buffer

/**
 * Capacitor routes fetch through native HTTP (no CORS), but its fetch patch
 * drops an explicit Origin header. Apple's catalog API refuses the motion
 * artwork lookup without Origin: https://music.apple.com, so requests that
 * set one go to the native plugin directly.
 */
const patchedFetch = window.fetch.bind(window)
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const headers = new Headers(init?.headers)
  if (!headers.has('origin')) return patchedFetch(input, init)
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const res = await CapacitorHttp.request({
    url,
    method: init?.method ?? 'GET',
    headers: Object.fromEntries(headers),
    data: init?.body ?? undefined,
    responseType: 'text',
  })
  const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
  return new Response(body, { status: res.status, headers: res.headers })
}
