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
    setSettings: (patch: Partial<Settings>) => setSettings(patch),
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

