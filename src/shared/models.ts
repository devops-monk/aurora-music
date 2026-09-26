/**
 * The data the whole app speaks in, ported from BitChord's `data/model/Models.kt`.
 *
 * The main process turns InnerTube responses into these, and nothing on the
 * renderer side ever sees a raw YouTube node, so a change in YouTube's shape is
 * one parser's problem rather than every screen's.
 */

export type BrowseType = 'album' | 'artist' | 'playlist' | 'other'

export interface Song {
  videoId: string
  title: string
  artist: string
  thumbnailUrl: string | null
  durationText?: string | null
  artistId?: string | null
  albumId?: string | null
  albumName?: string | null
  isVideo?: boolean
  explicit?: boolean
  /** Set when the song came from a playlist, needed to remove it later. */
  setVideoId?: string | null
}

export interface ShelfItem {
  title: string
  subtitle: string
  thumbnailUrl: string | null
  /** A playable item (song or video); tapping plays it. */
  videoId?: string | null
  /** A browsable item (album, playlist, artist); tapping opens it. */
  browseId?: string | null
  type: BrowseType | 'song' | 'video'
  /** Present on song items so a shelf tap can play without a round-trip. */
  song?: Song
}

export interface HomeShelf {
  title: string
  subtitle?: string
  items: ShelfItem[]
  /** Shelves of songs render as a paged row list rather than cards. */
  layout: 'cards' | 'songs'
  moreBrowseId?: string | null
  moreParams?: string | null
}

export interface HomeFeed {
  shelves: HomeShelf[]
  chips: string[]
  hasContinuation: boolean
}

export interface MoodGenre {
  title: string
  browseId: string
  params?: string | null
  color?: string | null
}

export interface MoodSection {
  title: string
  items: MoodGenre[]
}

export interface ExplorePage {
  /** New releases, charts, videos… */
  shelves: HomeShelf[]
  /** "Moods & moments", "Genres": the grids of coloured tiles. */
  moodSections: MoodSection[]
}

export type SearchFilter = 'all' | 'songs' | 'videos' | 'albums' | 'artists' | 'playlists'

export interface SearchResults {
  top?: ShelfItem | null
  songs: Song[]
  items: ShelfItem[]
  hasContinuation: boolean
}

export interface SearchSuggestion {
  text: string
  item?: ShelfItem
}

export interface DetailPage {
  browseId: string
  type: BrowseType
  title: string
  subtitle: string
  /** Album pages: the artist the subtitle names, so it can link there. */
  artistId?: string | null
  secondSubtitle?: string
  description?: string | null
  thumbnailUrl: string | null
  songs: Song[]
  sections: HomeShelf[]
  hasContinuation?: boolean
  /** Artist pages: the id of the full "Songs" playlist. */
  moreSongsBrowseId?: string | null
  subscriberText?: string | null
  /** Playlist id to use for shuffle/radio on this page. */
  playlistId?: string | null
}

export interface LibraryPage {
  playlists: ShelfItem[]
  albums: ShelfItem[]
  artists: ShelfItem[]
}

export interface Account {
  name: string
  email?: string
  thumbnailUrl?: string | null
  channelHandle?: string | null
}

export interface LyricLine {
  /** Milliseconds. */
  start: number
  end: number
  text: string
  /** Word-level timing, when the source had it. */
  words?: { start: number; end: number; text: string }[]
  /** A background-vocal line, rendered smaller like Apple Music. */
  background?: boolean
  /** Duet singer side, for right-aligned lines. */
  oppositeTurn?: boolean
}

export interface Lyrics {
  source: string
  synced: boolean
  lines: LyricLine[]
}

export type RepeatMode = 'off' | 'all' | 'one'

export interface StreamInfo {
  url: string
  mimeType: string
  bitrate: number
  sampleRate?: number
  channels?: number
  loudnessDb?: number
  durationMs?: number
}

/** Artwork sizes: one rung per surface, so surfaces share cache entries. */
export const ROW_ART_PX = 160
export const CARD_ART_PX = 480
export const HEADER_ART_PX = 720
export const PLAYER_ART_PX = 1200

const SIZE_HINT = /w\d+-h\d+/

/** The same artwork at a different size, for Google's `w…-h…` URLs. */
export function artworkAt(url: string | null | undefined, px: number): string | null {
  if (!url) return null
  if (SIZE_HINT.test(url)) return url.replace(SIZE_HINT, `w${px}-h${px}`)
  // i.ytimg.com video thumbnails do not resize, but the max-res one is square-croppable.
  return url
}

/** `"3:45"` or `"1:02:03"` in milliseconds; 0 for anything unparseable. */
export function durationMillis(text: string | null | undefined): number {
  const parts = text?.trim().split(':')
  if (!parts || parts.length < 2 || parts.length > 3) return 0
  const n = parts.map((p) => Number(p.trim()))
  if (n.some((x) => !Number.isFinite(x))) return 0
  const seconds = n.length === 2 ? n[0] * 60 + n[1] : n[0] * 3600 + n[1] * 60 + n[2]
  return Math.max(0, seconds * 1000)
}

export function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}
