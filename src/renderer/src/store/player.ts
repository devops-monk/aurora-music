import { create } from 'zustand'
import type { RepeatMode, Song, StreamInfo } from '@shared/models'
import { appendUnique, insertNext, move, removeAt, shuffled, unshuffled } from './queue'

export type PlayerPane = 'main' | 'lyrics' | 'queue'

/**
 * While in a Listen Together party, user actions become party controls instead
 * of local changes; the local queue then follows whatever the server says.
 */
export interface RemoteControl {
  playSongs(songs: Song[], startIndex: number): void
  playRadio(song: Song): void
  jumpTo(index: number): void
  /** [auto]: the track ended by itself (every device in the party sees that at once). */
  next(auto: boolean): void
  previous(): void
  playNext(song: Song): void
  addToQueue(song: Song): void
  removeAt(index: number): void
  setUpcoming(upcoming: Song[]): void
  appendRadio(songs: Song[]): void
}

let remote: RemoteControl | null = null
export const setRemoteControl = (r: RemoteControl | null) => {
  remote = r
}

export interface PlayOptions {
  /** "Playing from …" caption above Now Playing. */
  source?: string | null
  /** A playlist to continue from (album / playlist radio) once the list runs out. */
  playlistId?: string | null
  /** Start with shuffle on. */
  shuffle?: boolean
}

interface PlayerState {
  songs: Song[]
  index: number
  /** Pre-shuffle order, while shuffle is on. */
  original: Song[] | null
  repeat: RepeatMode
  isPlaying: boolean
  isLoading: boolean
  positionMs: number
  durationMs: number
  volume: number
  source: string | null
  radioPlaylistId: string | null
  /** Whether more radio should be fetched when the queue runs low. */
  radio: boolean
  stream: StreamInfo | null
  error: string | null
  liked: Record<string, boolean>
  nowPlayingOpen: boolean
  pane: PlayerPane
  /** Bumped on every explicit play request so the engine reloads even for the same song. */
  playToken: number

  current(): Song | null
  playSongs(songs: Song[], startIndex?: number, options?: PlayOptions): void
  /** A single track, followed by its radio. */
  playRadio(song: Song, source?: string | null): void
  playNext(song: Song): void
  addToQueue(song: Song): void
  jumpTo(index: number): void
  next(auto?: boolean): void
  previous(): void
  removeAt(index: number): void
  move(from: number, to: number): void
  /** Replaces everything after the current track with [upcoming], in that order (drag to reorder). */
  reorderUpcoming(upcoming: Song[]): void
  toggleShuffle(): void
  cycleRepeat(): void
  appendRadio(songs: Song[], playlistId?: string | null): void
  setVolume(volume: number): void
  setLiked(videoId: string, liked: boolean): void
  openNowPlaying(pane?: PlayerPane): void
  closeNowPlaying(): void
  setPane(pane: PlayerPane): void
  restore(songs: Song[], index: number, positionMs: number): void
}

export const usePlayer = create<PlayerState>((set, get) => ({
  songs: [],
  index: 0,
  original: null,
  repeat: 'off',
  isPlaying: false,
  isLoading: false,
  positionMs: 0,
  durationMs: 0,
  volume: 1,
  source: null,
  radioPlaylistId: null,
  radio: false,
  stream: null,
  error: null,
  liked: {},
  nowPlayingOpen: false,
  pane: 'main',
  playToken: 0,

  current: () => get().songs[get().index] ?? null,

  playSongs(songs, startIndex = 0, options = {}) {
    if (!songs.length) return
    if (remote) return remote.playSongs(songs, Math.min(Math.max(0, startIndex), songs.length - 1))
    let queue = { songs, index: Math.min(Math.max(0, startIndex), songs.length - 1) }
    let original: Song[] | null = null
    if (options.shuffle) {
      original = songs
      // Shuffle play starts anywhere, not on track one.
      queue = shuffled({ songs, index: Math.floor(Math.random() * songs.length) })
    }
    set((s) => ({
      ...queue,
      original,
      source: options.source ?? null,
      radioPlaylistId: options.playlistId ?? null,
      radio: true,
      positionMs: 0,
      durationMs: 0,
      error: null,
      playToken: s.playToken + 1,
    }))
  },

  playRadio(song, source = null) {
    if (remote) return remote.playRadio(song)
    set((s) => ({
      songs: [song],
      index: 0,
      original: null,
      source,
      radioPlaylistId: null,
      radio: true,
      positionMs: 0,
      durationMs: 0,
      error: null,
      playToken: s.playToken + 1,
    }))
  },

  playNext(song) {
    if (remote) return remote.playNext(song)
    const s = get()
    if (!s.songs.length) return s.playRadio(song)
    set(insertNext(s, song))
  },

  addToQueue(song) {
    if (remote) return remote.addToQueue(song)
    const s = get()
    if (!s.songs.length) return s.playRadio(song)
    set({ songs: [...s.songs, song] })
  },

  jumpTo(index) {
    const s = get()
    if (index < 0 || index >= s.songs.length) return
    if (remote) return remote.jumpTo(index)
    set({ index, positionMs: 0, durationMs: 0, error: null, playToken: s.playToken + 1 })
  },

  next(auto = false) {
    const s = get()
    if (remote) return remote.next(auto)
    if (auto && s.repeat === 'one') return set({ positionMs: 0, playToken: s.playToken + 1 })
    if (s.index + 1 < s.songs.length) return s.jumpTo(s.index + 1)
    if (s.repeat === 'all' && s.songs.length) return s.jumpTo(0)
    if (auto) set({ isPlaying: false })
  },

  previous() {
    const s = get()
    if (remote) return remote.previous()
    if (s.index > 0) s.jumpTo(s.index - 1)
    else set({ positionMs: 0, playToken: s.playToken + 1 })
  },

  removeAt(index) {
    if (remote) return remote.removeAt(index)
    set(removeAt(get(), index))
  },

  move(from, to) {
    if (remote) return remote.setUpcoming(move(get(), from, to).songs.slice(get().index + 1))
    set(move(get(), from, to))
  },

  reorderUpcoming(upcoming) {
    if (remote) return remote.setUpcoming(upcoming)
    const s = get()
    set({ songs: [...s.songs.slice(0, s.index + 1), ...upcoming] })
  },

  toggleShuffle() {
    const s = get()
    if (s.original) set({ ...unshuffled(s, s.original), original: null })
    else set({ ...shuffled(s), original: s.songs })
  },

  cycleRepeat() {
    const order: RepeatMode[] = ['off', 'all', 'one']
    set({ repeat: order[(order.indexOf(get().repeat) + 1) % order.length] })
  },

  appendRadio(songs, playlistId) {
    if (remote) return remote.appendRadio(songs)
    const s = get()
    const next = appendUnique(s, songs)
    set({
      ...next,
      original: s.original ? appendUnique({ songs: s.original, index: 0 }, songs).songs : null,
      radioPlaylistId: playlistId ?? s.radioPlaylistId,
      // Nothing new came back: stop asking until the next explicit play.
      radio: next !== s,
    })
  },

  setVolume(volume) {
    set({ volume: Math.min(1, Math.max(0, volume)) })
  },

  setLiked(videoId, liked) {
    set((s) => ({ liked: { ...s.liked, [videoId]: liked } }))
  },

  openNowPlaying(pane) {
    if (!get().songs.length) return
    set((s) => ({ nowPlayingOpen: true, pane: pane ?? s.pane }))
  },
  closeNowPlaying() {
    set({ nowPlayingOpen: false })
  },
  setPane(pane) {
    set((s) => ({ pane: s.pane === pane ? 'main' : pane }))
  },

  restore(songs, index, positionMs) {
    if (!songs.length) return
    set({ songs, index: Math.min(index, songs.length - 1), positionMs, radio: true })
  },
}))
