import { contextBridge, ipcRenderer } from 'electron'
import type { AuroraApi } from '@shared/api'

/**
 * `window.aurora`: the renderer's only door to the main process.
 *
 * The method list mirrors the handler table in src/main/ipc.ts, listed here
 * rather than imported, because the sandboxed preload cannot require project modules.
 */
const METHODS = [
  'home',
  'homeMore',
  'explore',
  'moodPage',
  'search',
  'searchMore',
  'suggestions',
  'browse',
  'browseMore',
  'upNext',
  'lyrics',
  'prefetch',
  'streamInfo',
  'library',
  'likedSongs',
  'like',
  'account',
  'signIn',
  'signOut',
  'getSettings',
  'setSettings',
  'saveQueue',
  'loadQueue',
  'openExternal',
  'downloads',
  'download',
  'removeDownload',
  'revealDownloads',
  'localSongs',
  'addLocalFolder',
  'removeLocalFolder',
  'partyView',
  'partyCreate',
  'partyJoin',
  'partyLeave',
  'partyControl',
  'partyReport',
  'partyProbe',
  'partyDefaultServer',
  'recordPlay',
  'replay',
  'replayMonths',
  'savePoster',
  'updatePresence',
  'discordStatus',
  'scrobbleStatus',
  'lastfmBeginAuth',
  'lastfmFinishAuth',
  'lastfmSignOut',
  'listenbrainzConnect',
  'nowPlaying',
  'scrobble',
] as const

const invoke = Object.fromEntries(
  METHODS.map((name) => [name, (...args: unknown[]) => ipcRenderer.invoke(`aurora:${name}`, ...args)]),
)

function subscribe<T>(channel: string, cb: (value: T) => void) {
  const listener = (_event: unknown, value: T) => cb(value)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api = {
  ...invoke,
  platform: process.platform,
  setTitleBarTheme: (dark: boolean) => ipcRenderer.send('aurora:setTitleBarTheme', dark),
  onMediaKey: (cb) => subscribe('aurora:media-key', cb),
  onFullscreen: (cb) => subscribe('aurora:fullscreen', cb),
  onDownloads: (cb) => subscribe('aurora:downloads', cb),
  onParty: (cb) => subscribe('aurora:party', cb),
} as AuroraApi

contextBridge.exposeInMainWorld('aurora', api)
