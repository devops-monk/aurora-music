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
  /** Listen Together server, e.g. https://party.example.com; empty uses the built-in default. */
  partyServer: string
  discordEnabled: boolean
  /** A Discord Application id; empty uses the one built in, if any. */
  discordClientId: string
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
  discordEnabled: true,
  discordClientId: '',
  partyServer: '',
}

// ---- Listen Together (BitChord party-server protocol) ----------------------

export interface PartyTrack {
  videoId: string
  title: string
  artist: string
  thumbnailUrl?: string
  durationMs?: number
  fromAutoplay?: boolean
}

export interface PartyPlayback {
  track: PartyTrack | null
  queueIndex: number
  isPlaying: boolean
  positionMs: number
  /** Server instant at which positionMs was true. */
  anchorMs: number
  seq: number
  queueSeq: number
  queueLength?: number
  updatedBy: string | null
  startedBy: string | null
  startedByName: string | null
  autoplayEnabled?: boolean
}

export interface PartyQueue {
  seq: number
  index: number
  items: PartyTrack[]
}

export interface PartyMember {
  memberId: string
  userId: string
  displayName: string
  avatarUrl?: string
  isHost: boolean
  connected: boolean
}

export interface PartyView {
  status: 'idle' | 'connecting' | 'connected' | 'reconnecting'
  code?: string
  you?: PartyMember
  members: PartyMember[]
  maxMembers: number
  hostOnlyControl: boolean
  playback?: PartyPlayback
  queue?: PartyQueue
  /** serverNow = Date.now() + offsetMs */
  offsetMs: number
  rttMs?: number
  error?: string
}

export interface PartyIdentity {
  userId: string
  displayName: string
  avatarUrl?: string | null
}

export type PartyControl =
  | { action: 'play'; positionMs?: number }
  | { action: 'pause'; positionMs?: number }
  | { action: 'seek'; positionMs: number }
  | { action: 'setTrack'; track: PartyTrack; positionMs?: number; isPlaying?: boolean; queueIndex?: number }
  | { action: 'setQueue'; queue: PartyTrack[]; queueIndex: number }
  | { action: 'queueAdd'; tracks: PartyTrack[]; playNext?: boolean }
  | { action: 'queueRemove'; videoId: string }
  | { action: 'queueMove'; fromIndex: number; toIndex: number; videoId?: string }
  | { action: 'next' }
  | { action: 'previous' }
  | { action: 'setHostOnlyControl'; enabled: boolean }

// ---- Replay (monthly listening stats) --------------------------------------------

export interface PlayRecord {
  song: Song
  startedAt: number
  /** Milliseconds actually heard (seeks excluded). */
  ms: number
}

export interface ReplayRank {
  key: string
  title: string
  subtitle: string
  thumbnailUrl: string | null
  plays: number
  minutes: number
  song?: Song
  browseId?: string | null
}

export interface ReplayMonth {
  /** YYYY-MM */
  month: string
  minutes: number
  plays: number
  distinctSongs: number
  distinctArtists: number
  memberSince: number | null
  perDayMinutes: number[]
  topSongs: ReplayRank[]
  topArtists: ReplayRank[]
  topAlbums: ReplayRank[]
}

export interface PresenceUpdate {
  song: Song
  positionMs: number
  durationMs: number
  playing: boolean
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

  partyView(): Promise<PartyView>
  partyCreate(who: PartyIdentity): Promise<PartyView>
  partyJoin(code: string, who: PartyIdentity): Promise<PartyView>
  partyLeave(): Promise<void>
  partyControl(control: PartyControl): Promise<void>
  partyReport(positionMs: number, isPlaying: boolean): Promise<void>
  partyProbe(address: string): Promise<boolean>
  partyDefaultServer(): Promise<string>
  onParty(cb: (view: PartyView) => void): () => void

  recordPlay(play: PlayRecord): Promise<void>
  replay(month?: string): Promise<ReplayMonth>
  replayMonths(): Promise<string[]>
  savePoster(dataUrl: string, month: string): Promise<boolean>

  updatePresence(update: PresenceUpdate | null): Promise<void>
  discordStatus(): Promise<{ connected: boolean; builtInId: boolean }>

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
