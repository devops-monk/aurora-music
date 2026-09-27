import { Capacitor } from '@capacitor/core'
import type { AuroraApi, PartyView, Settings } from '@shared/api'
import type { SearchFilter, Song } from '@shared/models'
import * as ytm from '../main/ytm/client'
import { resolveStream, setPreferredCodec, streamInfo } from '../main/ytm/stream'
import { lyricsFor } from '../main/lyrics'
import { translateLyrics } from '../main/translate'
import { motionForAlbum, motionForSong } from '../main/canvas'
import * as replayStore from '../main/replay'
import { getSettings, loadQueue, saveCookie, saveQueue, setSettings } from '../main/store'
import { warmUpPoToken } from './potoken'
import { SignIn } from './native'

/**
 * `window.aurora` on Android: the desktop's ipc.ts handler table, calling the
 * same shared modules directly instead of over IPC. What needs the desktop
 * (downloads, local folders, Discord, scrobbler auth, Listen Together
 * sockets) answers "not here yet" rather than failing.
 */

const IDLE_PARTY: PartyView = { status: 'idle', members: [], maxMembers: 5, hostOnlyControl: false, offsetMs: 0 } as PartyView
const unsupported = () => Promise.reject(new Error('Not available on Android yet'))
const noop = () => () => {}

if (Capacitor.getPlatform() === 'ios') setPreferredCodec('mp4a')

export const bridge = {
  platform: Capacitor.getPlatform(),

  home: () => ytm.home(),
  homeMore: () => ytm.homeMore(),
  explore: () => ytm.explore(),
  moodPage: (browseId: string, params?: string | null) => ytm.moodPage(browseId, params),
  search: (query: string, filter: SearchFilter) => ytm.search(query, filter),
  searchMore: () => ytm.searchMore(),
  suggestions: (query: string) => ytm.suggestions(query),
  browse: (browseId: string) => ytm.browse(browseId),
  browseMore: (browseId: string) => ytm.browseMore(browseId),
  upNext: (videoId: string, playlistId?: string | null) => ytm.upNext(videoId, playlistId),
  lyrics: (song: Song, durationMs: number) => lyricsFor(song, durationMs),
  prefetch: async (videoId: string) => {
    await resolveStream(videoId).catch(() => undefined)
  },
  streamInfo: (videoId: string) => streamInfo(videoId),
  /** Android plays googlevideo directly; the desktop proxies it through aurora://stream. */
  streamSrc: async (videoId: string) => (await resolveStream(videoId)).url,

  library: () => ytm.library(),
  likedSongs: () => ytm.likedSongs(),
  like: (videoId: string, liked: boolean) => ytm.like(videoId, liked),
  account: () => ytm.account(),
  signIn: async () => {
    const { cookie } = await SignIn.signIn()
    if (!cookie) return null
    saveCookie(cookie)
    ytm.resetSession()
    return ytm.account()
  },
  signOut: async () => {
    saveCookie(null)
    await SignIn.signOut()
    ytm.resetSession()
  },

  getSettings: async () => getSettings(),
  setSettings: async (patch: Partial<Settings>) => setSettings(patch),
  saveQueue: async (q: Parameters<typeof saveQueue>[0]) => saveQueue(q),
  loadQueue: async () => loadQueue(),

  downloads: async () => [],
  download: unsupported,
  removeDownload: async () => undefined,
  revealDownloads: async () => undefined,
  onDownloads: noop,
  localSongs: async () => [],
  addLocalFolder: async () => [],
  removeLocalFolder: async () => [],

  partyView: async () => IDLE_PARTY,
  partyCreate: unsupported,
  partyJoin: unsupported,
  partyLeave: async () => undefined,
  partyControl: async () => undefined,
  partyReport: async () => undefined,
  partyProbe: async () => false,
  partyDefaultServer: async () => '',
  onParty: noop,

  translateLyrics: (videoId: string, lines: string[], target: string) => translateLyrics(videoId, lines, target),
  motionForSong: (title: string, artist: string, album: string | null) => motionForSong(title, artist, album),
  motionForAlbum: (album: string, artist: string) => motionForAlbum(album, artist),

  recordPlay: async (play: Parameters<typeof replayStore.recordPlay>[0]) => replayStore.recordPlay(play),
  replay: async (month?: string) => replayStore.replay(month),
  replayMonths: async () => replayStore.replayMonths(),
  savePoster: async () => false,

  updatePresence: async () => undefined,
  discordStatus: async () => ({ connected: false, builtInId: false }),
  scrobbleStatus: async () => ({ lastfmAvailable: false, lastfmUser: null, listenbrainzConnected: false }),
  lastfmBeginAuth: unsupported,
  lastfmFinishAuth: unsupported,
  lastfmSignOut: unsupported,
  listenbrainzConnect: unsupported,
  nowPlaying: async () => undefined,
  scrobble: async () => undefined,

  openExternal: async (url: string) => {
    if (/^https:\/\//.test(url)) window.open(url, '_blank')
  },
  setTitleBarTheme: () => {},
  onMediaKey: noop,
  onFullscreen: noop,
} as unknown as AuroraApi

/** Starts BotGuard as the app opens, so the first song doesn't wait for it. */
export function warmUp() {
  warmUpPoToken()
}
