import { BrowserWindow, dialog, ipcMain, shell, app } from 'electron'
import { join } from 'node:path'
import type { Settings } from '@shared/api'
import type { SearchFilter, Song } from '@shared/models'
import * as ytm from './ytm/client'
import { resolveStream, streamInfo } from './ytm/stream'
import { lyricsFor } from './lyrics'
import { signIn, signOut } from './auth'
import { getSettings, loadQueue, saveQueue, setSettings } from './store'
import { download, downloadedPath, downloads, removeDownload } from './downloads'
import { isLocalId } from '@shared/models'
import { localSongs } from './local'
import * as scrobbler from './scrobble'
import { buildClientId, discordConnected, refreshPresence, updatePresence } from './discord'
import type { PartyControl, PartyIdentity, PresenceUpdate } from '@shared/api'
import * as party from './party'
import * as replayStore from './replay'
import type { PlayRecord } from '@shared/api'

/**
 * The one table of what the renderer may ask for. Every channel is
 * `aurora:<method>`, and the preload exposes exactly these names, so the
 * contract in `@shared/api` is the whole surface.
 */
export function registerIpc(getWindow: () => BrowserWindow | null) {
  const handlers: Record<string, (...args: never[]) => unknown> = {
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
      if (isLocalId(videoId) || downloadedPath(videoId)) return
      await resolveStream(videoId).catch(() => undefined)
    },
    streamInfo: (videoId: string) => streamInfo(videoId),
    library: () => ytm.library(),
    likedSongs: () => ytm.likedSongs(),
    like: (videoId: string, liked: boolean) => ytm.like(videoId, liked),
    account: () => ytm.account(),
    signIn: async () => {
      const ok = await signIn(getWindow())
      if (!ok) return null
      ytm.resetSession()
      return ytm.account()
    },
    signOut: async () => {
      await signOut()
      ytm.resetSession()
    },
    getSettings: () => getSettings(),
    setSettings: (patch: Partial<Settings>) => {
      const next = setSettings(patch)
      if ('discordEnabled' in patch || 'discordClientId' in patch) refreshPresence()
      return next
    },
    saveQueue: (q: Parameters<typeof saveQueue>[0]) => saveQueue(q),
    loadQueue: () => loadQueue(),
    downloads: () => downloads(),
    download: (song: Song) => {
      // Fire and forget: progress arrives on the aurora:downloads channel.
      download(song)
    },
    removeDownload: (videoId: string) => removeDownload(videoId),
    revealDownloads: () => shell.openPath(join(app.getPath('music'), 'Aurora Music')),
    localSongs: (rescan?: boolean) => localSongs(rescan),
    addLocalFolder: async () => {
      const win = getWindow()
      const res = win
        ? await dialog.showOpenDialog(win, { properties: ['openDirectory', 'multiSelections'], title: 'Add a music folder' })
        : await dialog.showOpenDialog({ properties: ['openDirectory', 'multiSelections'] })
      if (res.canceled) return getSettings().localFolders
      const folders = [...new Set([...getSettings().localFolders, ...res.filePaths])]
      setSettings({ localFolders: folders })
      await localSongs(true)
      return folders
    },
    removeLocalFolder: async (path: string) => {
      const folders = getSettings().localFolders.filter((f) => f !== path)
      setSettings({ localFolders: folders })
      await localSongs(true)
      return folders
    },
    partyView: () => party.partyView(),
    partyCreate: (who: PartyIdentity) => party.createParty(who),
    partyJoin: (code: string, who: PartyIdentity) => party.joinParty(code, who),
    partyLeave: () => party.leaveParty(),
    partyControl: (control: PartyControl) => party.partyControl(control),
    partyReport: (positionMs: number, isPlaying: boolean) => party.partyReport(positionMs, isPlaying),
    partyProbe: (address: string) => party.probeServer(address),
    partyDefaultServer: () => party.defaultServer(),
    recordPlay: (play: PlayRecord) => replayStore.recordPlay(play),
    replay: (month?: string) => replayStore.replay(month),
    replayMonths: () => replayStore.replayMonths(),
    savePoster: (dataUrl: string, month: string) => replayStore.savePoster(getWindow(), dataUrl, month),
    updatePresence: (update: PresenceUpdate | null) => updatePresence(update),
    discordStatus: () => ({ connected: discordConnected(), builtInId: !!buildClientId() }),
    scrobbleStatus: () => scrobbler.status(),
    lastfmBeginAuth: () => scrobbler.lastfmBeginAuth(),
    lastfmFinishAuth: () => scrobbler.lastfmFinishAuth(),
    lastfmSignOut: () => scrobbler.lastfmSignOut(),
    listenbrainzConnect: (token: string) => scrobbler.listenbrainzConnect(token),
    nowPlaying: (song: Song, durationMs: number) => scrobbler.nowPlaying(song, durationMs),
    scrobble: (song: Song, startedAt: number, durationMs: number) => scrobbler.scrobble(song, startedAt, durationMs),
    openExternal: (url: string) => {
      if (/^https:\/\//.test(url)) return shell.openExternal(url)
      return undefined
    },
  }

  for (const [name, fn] of Object.entries(handlers)) {
    ipcMain.handle(`aurora:${name}`, (_event, ...args) => (fn as (...a: unknown[]) => unknown)(...args))
  }

  ipcMain.on('aurora:setTitleBarTheme', (_event, dark: boolean) => {
    const win = getWindow()
    if (!win || process.platform === 'darwin') return
    try {
      win.setTitleBarOverlay({ color: '#00000000', symbolColor: dark ? '#ffffff' : '#000000', height: 44 })
    } catch {
      /* not every Linux WM supports overlays */
    }
  })
}

