/**
 * The YouTube Music session: every read the app makes goes through here.
 * The desktop counterpart of BitChord's `Innertube.kt` + `YtMusicRepository.kt`,
 * built on youtubei.js.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import vm from 'node:vm'
import { Innertube, Log, Platform, UniversalCache, YTNodes } from 'youtubei.js'
import type {
  Account,
  DetailPage,
  ExplorePage,
  HomeFeed,
  HomeShelf,
  LibraryPage,
  MoodGenre,
  MoodSection,
  SearchFilter,
  SearchResults,
  SearchSuggestion,
  ShelfItem,
  Song,
} from '@shared/models'
import type { UpNext } from '@shared/api'
import { bestThumb, browseTypeOfId, collectShelves, shelfItemOf, shelfOf, songOf, text } from './parse'
import { loadCookie } from '../store'

Log.setLevel(Log.Level.ERROR)

/**
 * YouTube's player script, which youtubei.js extracts the signature and `n`
 * transforms from, runs in a fresh V8 context with nothing in it but URL
 * helpers: no `require`, no `process`, no Electron. It is remote code, so it
 * gets exactly what deciphering needs.
 */
Platform.shim.eval = (data) =>
  vm.runInNewContext(`(function(){${data.output}\n})()`, { URL, URLSearchParams }, { timeout: 5000 })

let session: Promise<Innertube> | null = null

export function yt(): Promise<Innertube> {
  session ??= Innertube.create({
    cookie: loadCookie() ?? undefined,
    cache: new UniversalCache(false),
    retrieve_player: true,
    generate_session_locally: !loadCookie(),
  }).catch((e) => {
    session = null
    throw e
  })
  return session
}

/** Drops the session so the next call picks up a new cookie (sign in / out). */
export function resetSession() {
  session = null
  lastHome = null
  lastSearch = null
  playlists.clear()
}

export async function isSignedIn() {
  return (await yt()).session.logged_in
}

// ---- Home / Explore -------------------------------------------------------

let lastHome: any = null

export async function home(): Promise<HomeFeed> {
  const feed = await (await yt()).music.getHomeFeed()
  lastHome = feed
  return {
    shelves: (feed.sections ?? []).map(shelfOf).filter((s): s is HomeShelf => !!s),
    chips: feed.filters ?? [],
    hasContinuation: feed.has_continuation,
  }
}

export async function homeMore(): Promise<HomeShelf[]> {
  if (!lastHome?.has_continuation) return []
  try {
    lastHome = await lastHome.getContinuation()
  } catch {
    // "Continuation did not have any content": the feed has simply run out.
    lastHome = null
    return []
  }
  return (lastHome.sections ?? []).map(shelfOf).filter((s: HomeShelf | null): s is HomeShelf => !!s)
}

export async function explore(): Promise<ExplorePage> {
  const client = await yt()
  const page = await client.music.getExplore()
  const shelves = (page.sections ?? []).map(shelfOf).filter((s): s is HomeShelf => !!s)
  let moodSections: MoodSection[] = []
  try {
    const res: any = await client.actions.execute('/browse', {
      browseId: 'FEmusic_moods_and_genres',
      client: 'YTMUSIC',
      parse: true,
    })
    const grids: any[] = res.contents_memo?.getType(YTNodes.Grid) ?? []
    moodSections = grids
      .map((grid) => ({
        title: text(grid.header?.title) || text(grid.title),
        items: (grid.items ?? [])
          .filter((b: any) => b?.type === 'MusicNavigationButton')
          .map((b: any) => ({
            title: b.button_text,
            browseId: b.endpoint?.payload?.browseId,
            params: b.endpoint?.payload?.params ?? null,
          }))
          .filter((m: MoodGenre) => m.browseId && m.title),
      }))
      .filter((sec) => sec.items.length)
  } catch (e) {
    console.warn('[explore] moods failed', (e as Error).message)
  }
  return { shelves, moodSections }
}

export async function moodPage(browseId: string, params?: string | null): Promise<HomeShelf[]> {
  const res: any = await (await yt()).actions.execute('/browse', {
    browseId,
    params: params ?? undefined,
    client: 'YTMUSIC',
    parse: true,
  })
  return collectShelves(res.contents)
}

// ---- Search ---------------------------------------------------------------

let lastSearch: any = null

const FILTERS: Record<Exclude<SearchFilter, 'all'>, any> = {
  songs: 'song',
  videos: 'video',
  albums: 'album',
  artists: 'artist',
  playlists: 'playlist',
}

function searchResultsOf(res: any): SearchResults {
  const songs: Song[] = []
  const items: ShelfItem[] = []
  let top: ShelfItem | null = null
  for (const section of res.contents ?? []) {
    if (section.type === 'MusicCardShelf') {
      top = shelfItemOf({ ...section, endpoint: section.on_tap, title: section.title, subtitle: section.subtitle })
      for (const c of section.contents ?? []) {
        const s = c.type === 'MusicResponsiveListItem' ? songOf(c) : null
        if (s) songs.push(s)
      }
      continue
    }
    for (const c of section.contents ?? []) {
      if (c.type !== 'MusicResponsiveListItem') continue
      if (c.item_type === 'song' || c.item_type === 'video') {
        const s = songOf(c)
        if (s) songs.push(s)
      } else {
        const item = shelfItemOf(c)
        if (item) items.push(item)
      }
    }
  }
  return { top, songs, items, hasContinuation: !!res.has_continuation }
}

export async function search(query: string, filter: SearchFilter): Promise<SearchResults> {
  const client = await yt()
  const res = await client.music.search(query, filter === 'all' ? undefined : { type: FILTERS[filter] })
  lastSearch = res
  return searchResultsOf(res)
}

export async function searchMore(): Promise<SearchResults> {
  if (!lastSearch?.has_continuation) return { songs: [], items: [], hasContinuation: false }
  const next: any = await lastSearch.getContinuation()
  lastSearch = next
  const contents = next.contents?.contents ?? []
  return searchResultsOf({ contents: [{ contents }], has_continuation: next.has_continuation })
}

export async function suggestions(query: string): Promise<SearchSuggestion[]> {
  if (!query.trim()) return []
  const sections = await (await yt()).music.getSearchSuggestions(query)
  const out: SearchSuggestion[] = []
  for (const section of sections) {
    for (const c of (section as any).contents ?? []) {
      if (c.type === 'SearchSuggestion') out.push({ text: text(c.suggestion) })
      else if (c.type === 'MusicResponsiveListItem') {
        const item = shelfItemOf(c)
        if (item) out.push({ text: item.title, item })
      }
    }
  }
  return out
}

// ---- Browse (album / playlist / artist) -----------------------------------

const playlists = new Map<string, any>()

function headerOf(page: any) {
  const h = page.header?.header ?? page.header
  return h
}

export async function browse(browseId: string): Promise<DetailPage> {
  const client = await yt()
  const type = browseTypeOfId(browseId)
  if (type === 'album') {
    const album: any = await client.music.getAlbum(browseId)
    const h = headerOf(album)
    const cover = bestThumb(h?.thumbnail) ?? bestThumb(album.background)
    const artist = text(h?.strapline_text_one) || text(h?.subtitle).split(' • ').slice(-1)[0] || ''
    const artistId = h?.strapline_text_one?.runs?.find((r: any) => r.endpoint?.payload?.browseId)?.endpoint?.payload?.browseId ?? null
    const songs = (album.contents ?? [])
      .map((c: any) => songOf(c, { artist, artistId, thumbnailUrl: cover, albumId: browseId, albumName: text(h?.title) }))
      .filter(Boolean)
      .map((s: Song) => ({ ...s, thumbnailUrl: cover ?? s.thumbnailUrl, albumId: browseId, albumName: text(h?.title) }))
    const playlistId = album.contents?.[0]?.endpoint?.payload?.playlistId ?? null
    return {
      browseId,
      type,
      title: text(h?.title),
      subtitle: artist,
      artistId,
      secondSubtitle: [text(h?.subtitle), text(h?.second_subtitle)].filter(Boolean).join(' · '),
      description: text(h?.description?.description) || null,
      thumbnailUrl: cover,
      songs,
      sections: (album.sections ?? []).map(shelfOf).filter(Boolean),
      playlistId,
    } as DetailPage
  }
  if (type === 'artist') {
    const artist: any = await client.music.getArtist(browseId)
    const h = artist.header
    const shelves: HomeShelf[] = []
    let songs: Song[] = []
    let moreSongsBrowseId: string | null = null
    for (const section of artist.sections ?? []) {
      if (section.type === 'MusicShelf' && !songs.length) {
        songs = (section.contents ?? []).map((c: any) => songOf(c)).filter(Boolean)
        moreSongsBrowseId = section.endpoint?.payload?.browseId ?? section.bottom_button?.endpoint?.payload?.browseId ?? null
        continue
      }
      const shelf = shelfOf(section)
      if (shelf) shelves.push(shelf)
    }
    return {
      browseId,
      type,
      title: text(h?.title),
      subtitle: text(h?.subscription_button?.subscriber_count) || text(h?.subtitle) || '',
      description: text(h?.description) || null,
      thumbnailUrl: bestThumb(h?.thumbnail) ?? bestThumb(h?.foreground_thumbnail),
      songs,
      sections: shelves,
      moreSongsBrowseId,
      subscriberText: text(h?.subscription_button?.subscriber_count) || null,
      playlistId: h?.start_radio_button?.endpoint?.payload?.playlistId ?? null,
    }
  }
  // Playlists, including LM (liked music) and anything else browsable as one.
  const id = browseId.startsWith('VL') ? browseId.slice(2) : browseId
  const playlist: any = await client.music.getPlaylist(id)
  playlists.set(browseId, playlist)
  const h = headerOf(playlist)
  const songs = (playlist.items ?? []).map((c: any) => songOf(c)).filter(Boolean)
  return {
    browseId,
    type: 'playlist',
    title: text(h?.title),
    subtitle: text(h?.strapline_text_one) || text(h?.author?.name) || text(h?.subtitle).split(' • ')[0] || '',
    secondSubtitle: [text(h?.subtitle), text(h?.second_subtitle)].filter(Boolean).join(' · '),
    description: text(h?.description?.description) || text(h?.description) || null,
    thumbnailUrl: bestThumb(h?.thumbnail) ?? bestThumb(playlist.background) ?? songs[0]?.thumbnailUrl ?? null,
    songs,
    sections: [],
    hasContinuation: playlist.has_continuation,
    playlistId: id,
  }
}

export async function browseMore(browseId: string): Promise<Song[]> {
  const current = playlists.get(browseId)
  if (!current?.has_continuation) return []
  const next = await current.getContinuation()
  playlists.set(browseId, next)
  return (next.items ?? []).map((c: any) => songOf(c)).filter(Boolean)
}

// ---- Up next / radio ------------------------------------------------------

export async function upNext(videoId: string, playlistId?: string | null): Promise<UpNext> {
  const client = await yt()
  if (playlistId) {
    const res: any = await client.actions.execute('/next', {
      videoId,
      playlistId,
      client: 'YTMUSIC',
      parse: true,
    })
    const panel = res.contents_memo?.getType(YTNodes.PlaylistPanel)?.[0]
    if (panel) return { songs: panelSongs(panel), playlistId: panel.playlist_id }
  }
  const panel: any = await client.music.getUpNext(videoId, true)
  return { songs: panelSongs(panel), playlistId: panel.playlist_id }
}

function panelSongs(panel: any): Song[] {
  return (panel.contents ?? [])
    .map((c: any) => (c.type === 'PlaylistPanelVideoWrapper' ? c.primary : c))
    .filter((c: any) => c?.type === 'PlaylistPanelVideo')
    .map((c: any) => songOf(c))
    .filter(Boolean)
}

export async function youtubeLyrics(videoId: string): Promise<string | null> {
  try {
    const shelf: any = await (await yt()).music.getLyrics(videoId)
    return text(shelf?.description) || null
  } catch {
    return null
  }
}

// ---- Library / account ----------------------------------------------------

async function browseShelves(browseId: string): Promise<ShelfItem[]> {
  const res: any = await (await yt()).actions.execute('/browse', { browseId, client: 'YTMUSIC', parse: true })
  return collectShelves(res.contents).flatMap((s) => s.items)
}

export async function library(): Promise<LibraryPage> {
  if (!(await isSignedIn())) return { playlists: [], albums: [], artists: [] }
  const [playlistsList, albums, artists] = await Promise.all([
    browseShelves('FEmusic_liked_playlists').catch(() => []),
    browseShelves('FEmusic_liked_albums').catch(() => []),
    browseShelves('FEmusic_library_corpus_track_artists').catch(() => []),
  ])
  return { playlists: playlistsList.filter((p) => p.browseId), albums, artists }
}

export async function likedSongs(): Promise<Song[]> {
  if (!(await isSignedIn())) return []
  return (await browse('VLLM')).songs
}

export async function like(videoId: string, liked: boolean) {
  const client = await yt()
  if (liked) await client.interact.like(videoId)
  else await client.interact.removeRating(videoId)
}

export async function account(): Promise<Account | null> {
  const client = await yt()
  if (!client.session.logged_in) return null
  try {
    const res: any = await client.actions.execute('/account/account_menu', { client: 'YTMUSIC' })
    const header = res.data?.actions?.[0]?.openPopupAction?.popup?.multiPageMenuRenderer?.header?.activeAccountHeaderRenderer
    if (!header) return { name: 'YouTube Music' }
    return {
      name: header.accountName?.runs?.[0]?.text ?? 'YouTube Music',
      email: header.email?.runs?.[0]?.text,
      channelHandle: header.channelHandle?.runs?.[0]?.text ?? null,
      thumbnailUrl: bestThumb(header.accountPhoto?.thumbnails ?? []),
    }
  } catch {
    return { name: 'YouTube Music' }
  }
}
