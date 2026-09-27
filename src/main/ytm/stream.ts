/**
 * videoId → a googlevideo URL that serves the whole file. The desktop
 * `StreamResolver.kt` + `StreamChoice.kt`.
 *
 * Measured, not assumed (September 2026): WEB and TV answer with SABR-only
 * formats youtubei.js cannot decipher; IOS, MWEB and YTMUSIC return plain URLs,
 * but without a PO token googlevideo 403s every range past the first ~1 MB.
 * YTMUSIC with a token bound to the video id, on both the player request and
 * the URL's `pot`, serves every range, so that is the path, and the others are
 * only there for the rare track YTMUSIC declines outright.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { StreamInfo } from '@shared/models'
import { poToken } from '../potoken'
import { getSettings } from '../store'
import { downloadedPath } from '../downloads'
import { isLocalId } from '@shared/models'
import { yt } from './client'

interface Resolved extends StreamInfo {
  expiresAt: number
}

const resolved = new Map<string, Resolved>()
const inflight = new Map<string, Promise<Resolved>>()

/** URLs are good for ~6h; refresh well before that. */
const URL_MARGIN_MS = 30 * 60_000

function pickFormat(formats: any[]): any | null {
  const audio = formats.filter((f) => f.has_audio && !f.has_video && (f.url || f.signature_cipher || f.cipher))
  if (!audio.length) return null
  // Opus first, which Chromium plays natively and carries more per bit, then bitrate.
  const opus = audio.filter((f) => String(f.mime_type).includes('opus'))
  const pool = opus.length ? opus : audio
  const sorted = [...pool].sort((a, b) => b.bitrate - a.bitrate)
  return getSettings().audioQuality === 'low' ? sorted[sorted.length - 1] : sorted[0]
}

async function resolveWith(videoId: string, client: 'YTMUSIC' | 'IOS' | 'MWEB'): Promise<Resolved> {
  const session = await yt()
  const pot = client === 'YTMUSIC' ? await poToken(videoId) : undefined
  const info: any = await session.getBasicInfo(videoId, { client, po_token: pot })
  const status = info.playability_status?.status
  if (status && status !== 'OK') throw new Error(info.playability_status?.reason || status)
  const format = pickFormat(info.streaming_data?.adaptive_formats ?? [])
  if (!format) throw new Error('No audio format')
  let url: string = await format.decipher(session.session.player)
  if (pot) url += '&pot=' + encodeURIComponent(pot)
  const expire = Number(new URL(url).searchParams.get('expire')) * 1000
  return {
    url,
    mimeType: String(format.mime_type),
    bitrate: format.bitrate,
    sampleRate: Number(format.audio_sample_rate) || undefined,
    channels: format.audio_channels,
    loudnessDb: info.player_config?.audio_config?.loudness_db ?? format.loudness_db,
    durationMs: Number(format.approx_duration_ms) || undefined,
    expiresAt: (expire || Date.now() + 5 * 3600_000) - URL_MARGIN_MS,
  }
}

/** One client's attempt; past this, move on to the next client rather than leave the player spinning. */
const CLIENT_TIMEOUT_MS = 25_000

function attempt(videoId: string, client: 'YTMUSIC' | 'IOS' | 'MWEB'): Promise<Resolved> {
  return Promise.race([
    resolveWith(videoId, client),
    new Promise<Resolved>((_, reject) => setTimeout(() => reject(new Error(`${client} timed out`)), CLIENT_TIMEOUT_MS)),
  ])
}

async function resolveFresh(videoId: string): Promise<Resolved> {
  let lastError: unknown
  for (const client of ['YTMUSIC', 'IOS', 'MWEB'] as const) {
    try {
      return await attempt(videoId, client)
    } catch (e) {
      lastError = e
      console.warn(`[stream] ${client} failed for ${videoId}:`, (e as Error).message)
    }
  }
  throw lastError
}

export async function resolveStream(videoId: string, force = false): Promise<Resolved> {
  const hit = resolved.get(videoId)
  if (!force && hit && hit.expiresAt > Date.now()) return hit
  let pending = inflight.get(videoId)
  if (!pending) {
    pending = resolveFresh(videoId).finally(() => inflight.delete(videoId))
    inflight.set(videoId, pending)
  }
  const fresh = await pending
  if (resolved.size > 200) resolved.clear()
  resolved.set(videoId, fresh)
  return fresh
}

export function invalidateStream(videoId: string) {
  resolved.delete(videoId)
}

/** The stream's details without its URL, for the renderer's quality label. */
export async function streamInfo(videoId: string): Promise<StreamInfo> {
  if (isLocalId(videoId)) return { url: '', mimeType: 'local', bitrate: 0 }
  const saved = downloadedPath(videoId)
  if (saved) return { url: '', mimeType: saved.mimeType + '; downloaded', bitrate: 0 }
  const { url: _url, expiresAt: _e, ...rest } = await resolveStream(videoId)
  return { url: '', ...rest }
}
