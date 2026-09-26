import type {
  Account,
  DetailPage,
  ExplorePage,
  HomeFeed,
  HomeShelf,
  LibraryPage,
  Lyrics,
  SearchFilter,
  SearchResults,
  SearchSuggestion,
  Song,
  StreamInfo,
} from './models'

export interface Settings {
  theme: 'system' | 'dark' | 'light'
  reduceAnimation: boolean
  audioQuality: 'high' | 'low'
  normalizeVolume: boolean
  autoplay: boolean
  lyricsSources: ('lrclib' | 'youtube' | 'betterlyrics')[]
  volume: number
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  reduceAnimation: false,
  audioQuality: 'high',
  normalizeVolume: true,
  autoplay: true,
  lyricsSources: ['betterlyrics', 'lrclib', 'youtube'],
  volume: 1,
}

/** The queue as it is persisted between launches. */
export interface SavedQueue {
  songs: Song[]
  index: number
  positionMs: number
}

export interface UpNext {
  songs: Song[]
  /** Continuation playlist id for infinite radio. */
  playlistId?: string | null
}

/** Everything the renderer can ask of the main process, exposed as `window.aurora`. */
export interface AuroraApi {
  platform: NodeJS.Platform
  home(): Promise<HomeFeed>
  homeMore(): Promise<HomeShelf[]>
  explore(): Promise<ExplorePage>
  moodPage(browseId: string, params?: string | null): Promise<HomeShelf[]>
  search(query: string, filter: SearchFilter): Promise<SearchResults>
  searchMore(): Promise<SearchResults>
  suggestions(query: string): Promise<SearchSuggestion[]>
  browse(browseId: string): Promise<DetailPage>
  browseMore(browseId: string): Promise<Song[]>
  upNext(videoId: string, playlistId?: string | null): Promise<UpNext>
  lyrics(song: Song, durationMs: number): Promise<Lyrics | null>
  /** Warms the stream for a track so pressing play (or gapless next) is instant. */
  prefetch(videoId: string): Promise<void>
  /** Codec, bitrate and loudness of the stream a track resolves to. */
  streamInfo(videoId: string): Promise<StreamInfo>
  library(): Promise<LibraryPage>
  likedSongs(): Promise<Song[]>
  like(videoId: string, liked: boolean): Promise<void>

  account(): Promise<Account | null>
  signIn(): Promise<Account | null>
  signOut(): Promise<void>

  getSettings(): Promise<Settings>
  setSettings(patch: Partial<Settings>): Promise<Settings>
  saveQueue(queue: SavedQueue): Promise<void>
  loadQueue(): Promise<SavedQueue | null>

  openExternal(url: string): Promise<void>
  /** Keeps the native Windows/Linux caption buttons legible on the current theme. */
  setTitleBarTheme(dark: boolean): void
  onMediaKey(cb: (key: 'play-pause' | 'next' | 'previous') => void): () => void
  onFullscreen(cb: (fullscreen: boolean) => void): () => void
}

/** URL scheme the renderer's <audio> plays from; see src/main/protocol.ts. */
export const STREAM_SCHEME = 'aurora'
export const streamUrl = (videoId: string) => `${STREAM_SCHEME}://stream/${encodeURIComponent(videoId)}`
