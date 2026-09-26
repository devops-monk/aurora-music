import type {
  Account,
  DetailPage,
  DownloadEntry,
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
  /** 0 = gapless handover; 1–12 s = overlap and fade between tracks. */
  crossfadeSeconds: number
  eqEnabled: boolean
  /** Seven bands at 60, 150, 400, 1k, 2.5k, 6k, 14k Hz, in dB (±12). */
  eqBands: number[]
  eqPreset: string
  /** Folders scanned for Local Music. */
  localFolders: string[]
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  reduceAnimation: false,
  audioQuality: 'high',
  normalizeVolume: true,
  autoplay: true,
  lyricsSources: ['betterlyrics', 'lrclib', 'youtube'],
  volume: 1,
  crossfadeSeconds: 0,
  eqEnabled: false,
  eqBands: [0, 0, 0, 0, 0, 0, 0],
  eqPreset: 'Flat',
  localFolders: [],
}

export interface ScrobbleStatus {
  /** Whether this build carries Last.fm API credentials. */
  lastfmAvailable: boolean
  lastfmUser: string | null
  listenbrainzConnected: boolean
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

  downloads(): Promise<DownloadEntry[]>
  download(song: Song): Promise<void>
  removeDownload(videoId: string): Promise<void>
  onDownloads(cb: (list: DownloadEntry[]) => void): () => void
  revealDownloads(): Promise<void>

  localSongs(rescan?: boolean): Promise<Song[]>
  /** Opens a folder picker; resolves to the new folder list. */
  addLocalFolder(): Promise<string[]>
  removeLocalFolder(path: string): Promise<string[]>

  scrobbleStatus(): Promise<ScrobbleStatus>
  lastfmBeginAuth(): Promise<void>
  lastfmFinishAuth(): Promise<ScrobbleStatus>
  lastfmSignOut(): Promise<ScrobbleStatus>
  listenbrainzConnect(token: string): Promise<ScrobbleStatus>
  nowPlaying(song: Song, durationMs: number): Promise<void>
  scrobble(song: Song, startedAt: number, durationMs: number): Promise<void>

  openExternal(url: string): Promise<void>
  /** Keeps the native Windows/Linux caption buttons legible on the current theme. */
  setTitleBarTheme(dark: boolean): void
  onMediaKey(cb: (key: 'play-pause' | 'next' | 'previous') => void): () => void
  onFullscreen(cb: (fullscreen: boolean) => void): () => void
}

/** URL scheme the renderer's <audio> plays from; see src/main/protocol.ts. */
export const STREAM_SCHEME = 'aurora'
export const streamUrl = (videoId: string) => `${STREAM_SCHEME}://stream/${encodeURIComponent(videoId)}`
