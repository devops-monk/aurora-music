/* eslint-disable @typescript-eslint/no-explicit-any */
import { app } from 'electron'
import type { MotionArtwork } from '@shared/api'

/**
 * Animated album covers: Apple Music's motion artwork, after BitChord's
 * `AppleMusicCanvas.kt`. The catalog API exposes it as `editorialVideo`, as
 * HLS on Apple's CDN.
 *
 * Two problems to solve. The endpoint needs a bearer token, which is the
 * read-only one the web player mints for anonymous visitors, scraped from its
 * JS bundle (see `token`). And a free-text search returns a plausible-looking
 * wrong album for almost any query, so hits are scored rather than trusted: the
 * artist must match, compilations and editorial playlists are dropped, and
 * anything below `MIN_SCORE` is skipped even if it is the only hit. A wrong
 * cover is worse than none.
 *
 * Everything here is decoration: every failure resolves to null.
 */

const AMP = 'https://amp-api.music.apple.com/v1/catalog'
const WEB_PLAYER = 'https://music.apple.com/us/browse'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const TIMEOUT_MS = 10_000

/** Motion artwork is per storefront; use the system's region if it looks sane. */
function storefront(): string {
  const cc = app.getLocaleCountryCode()
  return /^[A-Za-z]{2}$/.test(cc) ? cc.toLowerCase() : 'us'
}

// ---- Matching helpers (BitChord's CanvasArtwork.kt) ------------------------

export function normalizeForMatch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const ARTIST_SEPARATORS = /(?:\s*,\s*|\s*&\s*|\s+×\s+|\s+x\s+|\bfeat\.?(?=\s|$)|\bft\.?(?=\s|$)|\bfeaturing\b|\bwith\b)/i

/** One credit string into its artists; every service joins them differently. */
export function splitArtists(raw: string): string[] {
  return raw
    .split(ARTIST_SEPARATORS)
    .map(normalizeForMatch)
    .filter(Boolean)
}

const EDITION_WORDS = ['deluxe', 'expanded', 'remastered', 'remix', 'version', 'edit', 'mix', 'bonus']
const COMPILATION_MARKERS = ['playlist', 'set list', 'essentials', 'dj mix', 'mixed', 'apple music', "today's hits", 'session']

/** Editorial playlists and radio mixes carry motion artwork of their own, which never belongs to the track. */
export function isCompilation(name: string): boolean {
  const lower = name.toLowerCase()
  return COMPILATION_MARKERS.some((m) => lower.includes(m))
}

/**
 * An exact artist and an exact title alone reach 25, so this admits only a hit
 * that matched on both, or the artist plus a fuzzy title and the right album.
 */
const MIN_SCORE = 12

interface Hit {
  name: string
  artist: string
  album: string
}

/** How well a hit lines up with what's playing, or null to reject it. Artist is a gate, not a score. */
export function score(hit: Hit, title: string, artist: string, album: string | null | undefined): number | null {
  if (isCompilation(hit.name) || isCompilation(hit.album)) return null
  const wanted = splitArtists(artist)
  const credited = splitArtists(hit.artist)
  if (!wanted.length || !credited.length) return null
  if (!wanted.every((w) => credited.includes(w))) return null

  let s = 10
  const wantTitle = normalizeForMatch(title)
  const hitTitle = normalizeForMatch(hit.name)
  if (hitTitle === wantTitle) s += 15
  else if (hitTitle.includes(wantTitle) || wantTitle.includes(hitTitle)) s += 7
  // Same artist, different song: exactly the mismatch that has to stay out.
  else s -= 10

  if (album && hit.album) {
    const want = normalizeForMatch(album)
    const got = normalizeForMatch(hit.album)
    if (got === want) s += 20
    else if (got.includes(want) || want.includes(got)) s += 10
  }

  // A "(Deluxe)" or "(Remastered)" on one side only is a different master, often a different clip.
  for (const word of EDITION_WORDS) {
    const inWanted = title.toLowerCase().includes(word)
    const inHit = hit.name.toLowerCase().includes(word)
    if (inWanted && inHit) s += 5
    else if (inHit) s -= 3
  }
  return s
}

/** The square rendition first: it fills a square sleeve without cropping. */
function motionUrls(video: any): { url: string; fallbackUrl: string | null } | null {
  const link = (key: string): string | null => {
    const a = video?.[key]
    const u = a?.video ?? a?.videoUrl ?? a?.hlsUrl ?? a?.url
    return typeof u === 'string' && u ? u : null
  }
  const square = link('motionDetailSquare') ?? link('motionSquareVideo1x1')
  const raw = link('motionDetailRaw')
  const tall = link('motionDetailTall') ?? link('motionTallVideo3x4')
  const url = square ?? raw ?? tall
  if (!url) return null
  return { url, fallbackUrl: [square, raw, tall].find((u) => u && u !== url) ?? null }
}

// ---- Token ------------------------------------------------------------------

let cachedToken: string | null = null
let tokenExpiresAt = 0
let retryTokenAfter = 0
const rejected = new Set<string>()
const TOKEN_RETRY_MS = 30 * 60_000

function jwtPart(jwt: string, i: number): any {
  try {
    return JSON.parse(Buffer.from(jwt.split('.')[i], 'base64url').toString())
  } catch {
    return null
  }
}

async function getText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    return res.ok ? await res.text() : null
  } catch {
    return null
  }
}

let tokenInFlight: Promise<string | null> | null = null

/**
 * The web player's anonymous token, picked out of its JS bundle by issuer (the
 * bundle ships other JWTs that the catalog rejects). Held until shortly before
 * it expires; a failed scrape backs off rather than retrying on every track.
 */
function token(): Promise<string | null> {
  const now = Date.now()
  if (cachedToken && now < tokenExpiresAt - 60_000) return Promise.resolve(cachedToken)
  if (now < retryTokenAfter) return Promise.resolve(null)
  tokenInFlight ??= (async () => {
    const html = await getText(WEB_PLAYER)
    const scripts = [...new Set(html?.match(/\/assets\/index(?:-legacy)?[~-][A-Za-z0-9_-]+\.js/g) ?? [])]
    for (const path of scripts) {
      const js = await getText('https://music.apple.com' + path)
      if (!js) continue
      const candidates = [...new Set(js.match(/ey[A-Za-z0-9_-]+\.ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? [])]
        .filter((j) => !rejected.has(j))
        .map((j) => ({ jwt: j, exp: (jwtPart(j, 1)?.exp ?? 0) * 1000 }))
        .filter((c) => c.exp > Date.now())
      if (!candidates.length) continue
      const pick =
        candidates.find((c) => jwtPart(c.jwt, 0)?.kid === 'WebPlayKid' || jwtPart(c.jwt, 1)?.iss === 'AMPWebPlay') ??
        candidates[0]
      cachedToken = pick.jwt
      tokenExpiresAt = pick.exp
      return pick.jwt
    }
    retryTokenAfter = Date.now() + TOKEN_RETRY_MS
    return null
  })().finally(() => (tokenInFlight = null))
  return tokenInFlight
}

/** An authenticated catalog read. A 401 strikes the token off so the next lookup re-scrapes. */
async function amp(path: string, params: Record<string, string>): Promise<any | null> {
  const bearer = await token()
  if (!bearer) return null
  try {
    const res = await fetch(`${AMP}/${storefront()}/${path}?${new URLSearchParams(params)}`, {
      headers: {
        Authorization: `Bearer ${bearer}`,
        Origin: 'https://music.apple.com',
        Referer: 'https://music.apple.com/',
        'User-Agent': UA,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (res.status === 401) {
      rejected.add(bearer)
      if (cachedToken === bearer) {
        cachedToken = null
        tokenExpiresAt = 0
      }
      return null
    }
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

// ---- Lookups ----------------------------------------------------------------

function hitOf(record: any, albumIsSelf = false): Hit {
  const a = record?.attributes ?? {}
  return { name: a.name ?? '', artist: a.artistName ?? '', album: (albumIsSelf ? a.name : a.albumName) ?? '' }
}

function albumIdOf(song: any): string | null {
  const rel = song?.relationships?.albums?.data?.[0]?.id
  if (typeof rel === 'string') return rel.startsWith('pl.') ? null : rel
  // The web URL always ends in the album id: .../album/<slug>/<id>?i=<song id>
  const m = /\/album\/(?:[^/?]+\/)?(\d+)/.exec(song?.attributes?.url ?? '')
  return m?.[1] ?? null
}

async function fromAlbum(id: string): Promise<MotionArtwork | null> {
  const data = await amp(`albums/${id}`, { extend: 'editorialVideo' })
  const attrs = data?.data?.[0]?.attributes
  if (!attrs || isCompilation(attrs.name ?? '')) return null
  const urls = motionUrls(attrs.editorialVideo)
  return urls && { ...urls, album: attrs.name ?? null }
}

async function searchSong(title: string, artist: string, album: string | null): Promise<MotionArtwork | null> {
  // Fold everything known into the term; an artist alone pulls in their whole discography.
  let term = title.toLowerCase().includes(artist.toLowerCase()) ? title : `${artist} ${title}`
  if (album && !title.toLowerCase().includes(album.toLowerCase())) term += ` ${album}`
  const data = await amp('search', { term, types: 'songs', limit: '10', extend: 'editorialVideo', include: 'albums' })
  const hits: any[] = data?.results?.songs?.data ?? []
  const ranked = hits
    .map((h) => ({ h, s: score(hitOf(h), title, artist, album) }))
    .filter((r): r is { h: any; s: number } => r.s !== null)
    .sort((a, b) => b.s - a.s)
  for (const { h, s } of ranked) {
    if (s < MIN_SCORE) break
    const inline = motionUrls(h.attributes?.editorialVideo)
    if (inline) return { ...inline, album: h.attributes?.albumName ?? null }
    const id = albumIdOf(h)
    const found = id && (await fromAlbum(id))
    if (found) return found
  }
  return null
}

async function searchAlbum(album: string, artist: string): Promise<MotionArtwork | null> {
  const term = album.toLowerCase().includes(artist.toLowerCase()) ? album : `${artist} ${album}`
  const data = await amp('search', { term, types: 'albums', limit: '10', extend: 'editorialVideo' })
  const hits: any[] = data?.results?.albums?.data ?? []
  const ranked = hits
    .map((h) => ({ h, s: score(hitOf(h, true), album, artist, album) }))
    .filter((r): r is { h: any; s: number } => r.s !== null)
    .sort((a, b) => b.s - a.s)
  for (const { h, s } of ranked) {
    if (s < MIN_SCORE) break
    const urls = motionUrls(h.attributes?.editorialVideo)
    if (urls) return { ...urls, album: h.attributes?.name ?? null }
  }
  return null
}

/** Answers, misses included, for the session: most tracks have none, and asking again won't change that. */
const cache = new Map<string, Promise<MotionArtwork | null>>()

function cached(key: string, run: () => Promise<MotionArtwork | null>): Promise<MotionArtwork | null> {
  let hit = cache.get(key)
  if (!hit) {
    hit = run().catch(() => null)
    cache.set(key, hit)
    // A failed token scrape isn't an answer about this track; let it be asked again later.
    hit.then((r) => r === null && !cachedToken && cache.delete(key))
  }
  return hit
}

export function motionForSong(title: string, artist: string, album: string | null): Promise<MotionArtwork | null> {
  if (!title || !artist) return Promise.resolve(null)
  return cached(`s|${title}|${artist}|${album ?? ''}`, () => searchSong(title, artist, album))
}

export function motionForAlbum(album: string, artist: string): Promise<MotionArtwork | null> {
  if (!album || !artist) return Promise.resolve(null)
  return cached(`a|${album}|${artist}`, () => searchAlbum(album, artist))
}
