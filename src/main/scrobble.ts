import { shell } from 'electron'
import { createHash } from 'node:crypto'
import { primaryArtist, type Song } from '@shared/models'
import type { ScrobbleStatus } from '@shared/api'
import { getSecret, setSecret } from './store'

/**
 * Last.fm and ListenBrainz, the desktop `LastFM.kt` + `ListenBrainzManager.kt`.
 *
 * Last.fm signs in through its web flow (auth.getToken → the user approves in
 * their browser → auth.getSession), so the app never sees a password. It needs
 * an API key and secret, supplied at build time the way the Android app takes
 * them from local.properties. ListenBrainz needs only the user's token.
 */

const LASTFM = 'https://ws.audioscrobbler.com/2.0/'
const LISTENBRAINZ = 'https://api.listenbrainz.org/1'
const AGENT = 'Aurora Music (https://github.com/devops-monk/aurora-music)'

const LASTFM_KEY = import.meta.env.MAIN_VITE_LASTFM_API_KEY ?? ''
const LASTFM_SECRET = import.meta.env.MAIN_VITE_LASTFM_SECRET ?? ''


function sign(params: Record<string, string>): string {
  const base = Object.keys(params)
    .filter((k) => k !== 'format' && k !== 'callback')
    .sort()
    .map((k) => k + params[k])
    .join('')
  return createHash('md5').update(base + LASTFM_SECRET, 'utf8').digest('hex')
}

async function lastfm(method: string, params: Record<string, string>, post = false) {
  const all: Record<string, string> = { ...params, method, api_key: LASTFM_KEY }
  all.api_sig = sign(all)
  all.format = 'json'
  const body = new URLSearchParams(all)
  const res = post
    ? await fetch(LASTFM, { method: 'POST', body, headers: { 'User-Agent': AGENT } })
    : await fetch(`${LASTFM}?${body}`, { headers: { 'User-Agent': AGENT } })
  const json = (await res.json()) as Record<string, unknown> & { error?: number; message?: string }
  if (json.error) throw new Error(`Last.fm: ${json.message ?? json.error}`)
  return json
}

let pendingToken: string | null = null

export function status(): ScrobbleStatus {
  return {
    lastfmAvailable: !!(LASTFM_KEY && LASTFM_SECRET),
    lastfmUser: getSecret('lastfm.name'),
    listenbrainzConnected: !!getSecret('listenbrainz.token'),
  }
}

/** Step one: open Last.fm in the browser for the user to approve Aurora. */
export async function lastfmBeginAuth() {
  if (!LASTFM_KEY) throw new Error('This build has no Last.fm API key.')
  const { token } = (await lastfm('auth.getToken', {})) as unknown as { token: string }
  pendingToken = token
  await shell.openExternal(`https://www.last.fm/api/auth/?api_key=${LASTFM_KEY}&token=${token}`)
}

/** Step two, after approving: trade the token for a session key. */
export async function lastfmFinishAuth(): Promise<ScrobbleStatus> {
  if (!pendingToken) throw new Error('Start Last.fm sign-in first.')
  const res = (await lastfm('auth.getSession', { token: pendingToken })) as unknown as { session: { name: string; key: string } }
  setSecret('lastfm.key', res.session.key)
  setSecret('lastfm.name', res.session.name)
  pendingToken = null
  return status()
}

export function lastfmSignOut(): ScrobbleStatus {
  setSecret('lastfm.key', null)
  setSecret('lastfm.name', null)
  return status()
}

/** Checks a ListenBrainz token against the API before keeping it. */
export async function listenbrainzConnect(token: string): Promise<ScrobbleStatus> {
  if (!token.trim()) {
    setSecret('listenbrainz.token', null)
    return status()
  }
  const res = await fetch(`${LISTENBRAINZ}/validate-token`, { headers: { Authorization: `Token ${token.trim()}` } })
  const json = (await res.json()) as { valid?: boolean }
  if (!json.valid) throw new Error('ListenBrainz did not accept that token.')
  setSecret('listenbrainz.token', token.trim())
  return status()
}

function listenPayload(song: Song, durationMs: number) {
  return {
    track_metadata: {
      artist_name: primaryArtist(song.artist),
      track_name: song.title,
      ...(song.albumName ? { release_name: song.albumName } : {}),
      additional_info: {
        media_player: 'Aurora Music',
        submission_client: 'Aurora Music',
        music_service: 'music.youtube.com',
        origin_url: `https://music.youtube.com/watch?v=${song.videoId}`,
        ...(durationMs ? { duration_ms: Math.round(durationMs) } : {}),
      },
    },
  }
}

async function listenbrainz(type: 'playing_now' | 'single', listen: object) {
  const token = getSecret('listenbrainz.token')
  if (!token) return
  await fetch(`${LISTENBRAINZ}/submit-listens`, {
    method: 'POST',
    headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json', 'User-Agent': AGENT },
    body: JSON.stringify({ listen_type: type, payload: [listen] }),
  })
}

export async function nowPlaying(song: Song, durationMs: number) {
  const key = getSecret('lastfm.key')
  await Promise.allSettled([
    key && LASTFM_KEY
      ? lastfm(
          'track.updateNowPlaying',
          {
            artist: primaryArtist(song.artist),
            track: song.title,
            ...(song.albumName ? { album: song.albumName } : {}),
            ...(durationMs ? { duration: String(Math.round(durationMs / 1000)) } : {}),
            sk: key,
          },
          true,
        )
      : null,
    listenbrainz('playing_now', listenPayload(song, durationMs)),
  ])
}

export async function scrobble(song: Song, startedAt: number, durationMs: number) {
  const key = getSecret('lastfm.key')
  const timestamp = Math.floor(startedAt / 1000)
  await Promise.allSettled([
    key && LASTFM_KEY
      ? lastfm(
          'track.scrobble',
          {
            artist: primaryArtist(song.artist),
            track: song.title,
            timestamp: String(timestamp),
            ...(song.albumName ? { album: song.albumName } : {}),
            ...(durationMs ? { duration: String(Math.round(durationMs / 1000)) } : {}),
            sk: key,
          },
          true,
        )
      : null,
    listenbrainz('single', { listened_at: timestamp, ...listenPayload(song, durationMs) }),
  ])
}
