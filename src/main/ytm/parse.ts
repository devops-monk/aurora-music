/**
 * youtubei.js nodes → Aurora's models. The desktop counterpart of BitChord's
 * `InnertubeParser.kt`.
 *
 * Everything here reads nodes duck-typed (`any`): youtubei.js's classes are
 * the right shape, but YouTube moves fields between them often enough that a
 * missing property must mean "absent", never a crash.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BrowseType, HomeShelf, ShelfItem, Song } from '@shared/models'

/** Node text as a plain string. youtubei.js renders empty Text as "N/A", which is never real content here. */
const str = (t: any): string => {
  const s = (t == null ? '' : typeof t === 'string' ? t : (t.toString?.() ?? t.text ?? '')).trim()
  return s === 'N/A' ? '' : s
}

/** The largest thumbnail in whatever wrapper a node carries it in. */
export function bestThumb(node: any): string | null {
  const list: any[] =
    (Array.isArray(node) && node) ||
    node?.thumbnail?.contents ||
    (Array.isArray(node?.thumbnail) && node.thumbnail) ||
    node?.thumbnails ||
    node?.thumbnail?.thumbnails ||
    node?.contents ||
    []
  if (!Array.isArray(list) || list.length === 0) return null
  const best = [...list].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]
  let url: string = best?.url ?? ''
  if (url.startsWith('//')) url = 'https:' + url
  return url || null
}

const isExplicit = (node: any) =>
  JSON.stringify(node?.badges ?? node?.subtitle_badges ?? []).includes('MUSIC_EXPLICIT_BADGE')

function browseTypeOfPage(pageType?: string): BrowseType {
  switch (pageType) {
    case 'MUSIC_PAGE_TYPE_ALBUM':
    case 'MUSIC_PAGE_TYPE_AUDIOBOOK':
      return 'album'
    case 'MUSIC_PAGE_TYPE_ARTIST':
    case 'MUSIC_PAGE_TYPE_USER_CHANNEL':
    case 'MUSIC_PAGE_TYPE_LIBRARY_ARTIST':
      return 'artist'
    case 'MUSIC_PAGE_TYPE_PLAYLIST':
    case 'MUSIC_PAGE_TYPE_PODCAST_SHOW_DETAIL_PAGE':
      return 'playlist'
    default:
      return 'other'
  }
}

export function browseTypeOfId(id: string): BrowseType {
  if (id.startsWith('MPREb_')) return 'album'
  if (id.startsWith('UC') || id.startsWith('MPLA')) return 'artist'
  if (/^(VL|PL|RD|OLAK|LM|SE)/.test(id)) return 'playlist'
  return 'other'
}

const pageTypeOf = (endpoint: any): string | undefined =>
  endpoint?.payload?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType

const artistLine = (artists?: { name: string }[], fallback = '') =>
  artists?.length ? artists.map((a) => a.name).join(', ') : fallback

const NOT_AN_ARTIST = /^(song|video|single|ep|album|episode|\d+(:\d+)+|[\d.,]+[KMB]? (views|plays))$/i

/**
 * Some rows (a top-result card's songs, chart rows) carry no `artists`, only the
 * second text column: "Song • Daft Punk • 4:02". The first part that is not a
 * type, a duration or a count is the credit.
 */
function artistFromColumns(node: any): string {
  const line = str(node?.flex_columns?.[1]?.title) || str(node?.subtitle)
  return line.split(' • ').map((p) => p.trim()).find((p) => p && !NOT_AN_ARTIST.test(p)) ?? ''
}

/** A MusicResponsiveListItem or PlaylistPanelVideo that is a song or video. */
export function songOf(node: any, fallback: Partial<Song> = {}): Song | null {
  const videoId: string | undefined =
    node?.video_id ?? (node?.item_type === 'song' || node?.item_type === 'video' ? node?.id : undefined) ??
    node?.endpoint?.payload?.videoId ?? node?.overlay?.content?.endpoint?.payload?.videoId
  if (!videoId) return null
  const artists = node.artists ?? node.authors ?? (node.author ? [node.author] : undefined)
  const title = str(node.title) || str(node.name) || str(node.flex_columns?.[0]?.title)
  const artistText =
    artistLine(artists?.filter((a: any) => a?.name), '') ||
    (typeof node.author === 'string' ? node.author : '') ||
    artistFromColumns(node) ||
    fallback.artist ||
    ''
  return {
    videoId,
    title,
    artist: artistText,
    artistId: artists?.find((a: any) => a?.channel_id)?.channel_id ?? fallback.artistId ?? null,
    thumbnailUrl: bestThumb(node) ?? fallback.thumbnailUrl ?? null,
    durationText: node.duration?.text || fallback.durationText || null,
    albumId: node.album?.id ?? fallback.albumId ?? null,
    albumName: node.album?.name ?? fallback.albumName ?? null,
    isVideo: node.item_type === 'video' || node.item_type === 'non_music_track',
    explicit: isExplicit(node),
    setVideoId: node.set_video_id ?? node.playlist_item_data?.playlist_set_video_id ?? null,
  }
}

/** A card-shaped item (MusicTwoRowItem, or a list item for an album/playlist/artist). */
export function shelfItemOf(node: any): ShelfItem | null {
  if (!node) return null
  if (node.type === 'MusicResponsiveListItem' && (node.item_type === 'song' || node.item_type === 'video')) {
    const song = songOf(node)
    return song
      ? { title: song.title, subtitle: song.artist, thumbnailUrl: song.thumbnailUrl, videoId: song.videoId, type: song.isVideo ? 'video' : 'song', song }
      : null
  }
  const endpoint = node.endpoint ?? node.title?.endpoint
  const payload = endpoint?.payload ?? {}
  const title = str(node.title) || str(node.name)
  const subtitle = str(node.subtitle) || artistLine(node.artists ?? node.authors)
  const thumbnailUrl = bestThumb(node)
  if (payload.videoId) {
    const song: Song = {
      videoId: payload.videoId,
      title,
      artist: artistLine(node.artists ?? node.authors, subtitle.split(' • ').pop() ?? ''),
      artistId: node.artists?.[0]?.channel_id ?? null,
      thumbnailUrl,
      isVideo: node.item_type === 'video',
      explicit: isExplicit(node),
    }
    return { title, subtitle, thumbnailUrl, videoId: payload.videoId, type: node.item_type === 'video' ? 'video' : 'song', song }
  }
  const browseId: string | undefined = payload.browseId ?? node.id
  if (!browseId) return null
  const pageType = pageTypeOf(endpoint)
  const type = pageType ? browseTypeOfPage(pageType) : browseTypeOfId(browseId)
  return { title, subtitle, thumbnailUrl, browseId, type }
}

/** MusicCarouselShelf / MusicShelf / Grid → a shelf, or null when it has nothing we can show. */
export function shelfOf(node: any): HomeShelf | null {
  const contents: any[] = node?.contents ?? node?.items ?? []
  const title = str(node?.header?.title) || str(node?.title) || str(node?.header?.header?.title)
  const listItems = contents.filter((c) => c?.type === 'MusicResponsiveListItem')
  const songsLayout = listItems.length > 0 && listItems.every((c) => c.item_type === 'song' || c.item_type === 'video')
  // Nameless, artless entries (Explore's mood buttons, which it also lists as a proper grid) would render as blank tiles.
  const items = contents.map(shelfItemOf).filter((x): x is ShelfItem => !!x && !!(x.title || x.thumbnailUrl))
  if (!items.length) return null
  const more = node?.header?.more_content?.endpoint?.payload ?? node?.bottom_button?.endpoint?.payload ?? node?.endpoint?.payload
  return {
    title,
    subtitle: str(node?.header?.strapline) || undefined,
    items,
    layout: songsLayout ? 'songs' : 'cards',
    moreBrowseId: more?.browseId ?? null,
    moreParams: more?.params ?? null,
  }
}

/** Every shelf-like node anywhere under [root], in document order. */
export function collectShelves(root: any, depth = 0, out: HomeShelf[] = []): HomeShelf[] {
  if (!root || depth > 8) return out
  if (Array.isArray(root)) {
    root.forEach((r) => collectShelves(r, depth + 1, out))
    return out
  }
  if (typeof root !== 'object') return out
  // A raw `actions.execute(..., { parse: true })` wraps its nodes in a SuperParsedResult.
  if (typeof root.item === 'function' && typeof root.array === 'function' && 'is_null' in root) {
    return root.is_null ? out : collectShelves(root.is_array ? root.array() : root.item(), depth + 1, out)
  }
  if (['MusicCarouselShelf', 'MusicShelf', 'Grid', 'MusicPlaylistShelf'].includes(root.type)) {
    const shelf = shelfOf(root)
    if (shelf) out.push(shelf)
    return out
  }
  for (const key of ['contents', 'content', 'tabs', 'sections', 'section_list', 'items']) {
    if (root[key]) collectShelves(root[key], depth + 1, out)
  }
  return out
}

export { str as text }
