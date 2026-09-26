import { create } from 'zustand'
import type { DownloadEntry } from '@shared/models'

interface DownloadsState {
  list: DownloadEntry[]
  byId: Record<string, DownloadEntry>
}

export const useDownloads = create<DownloadsState>(() => ({ list: [], byId: {} }))

const apply = (list: DownloadEntry[]) =>
  useDownloads.setState({ list, byId: Object.fromEntries(list.map((e) => [e.song.videoId, e])) })

export function startDownloadsSync() {
  window.aurora.downloads().then(apply)
  return window.aurora.onDownloads(apply)
}
