import { artworkAt, durationMillis, PLAYER_ART_PX, type Song } from '@shared/models'
import { streamUrl } from '@shared/api'
import { usePlayer } from '../store/player'
import { useSettings } from '../store/settings'

/**
 * Playback, the desktop `PlaybackService.kt` for the MVP: two <audio>
 * elements, so the next track is already buffered when the current one ends
 * and the handover is gapless; radio top-up as the queue runs low
 * (`Autoplay.kt`); loudness normalisation from YouTube's `loudness_db`; and the
 * Media Session, which puts the track in macOS Now Playing, Windows' media
 * flyout and Linux MPRIS, and wires hardware media keys.
 */

/** Start buffering the next track this long before the current one ends. */
const PRELOAD_LEAD_S = 25
/** Keep this many tracks of runway before asking for more radio. */
const RADIO_RUNWAY = 3
/** Treat "previous" as "restart" past this point, like every music app. */
const RESTART_THRESHOLD_MS = 3000

const elements = [new Audio(), new Audio()]
elements.forEach((el) => {
  el.preload = 'auto'
})
let active = 0
/** videoId the spare element has buffered, if any. */
let spareFor: string | null = null
let loadedToken = -1
let loadedVideoId: string | null = null
let normalization = 1
let radioInFlight = false
let pendingSeekMs = 0

const cur = () => elements[active]
const spare = () => elements[1 - active]

export const getPositionMs = () => cur().currentTime * 1000

function applyVolume() {
  const { volume } = usePlayer.getState()
  const gain = useSettings.getState().normalizeVolume ? normalization : 1
  // A perceptual curve: linear slider positions are far too loud at the bottom.
  cur().volume = Math.min(1, Math.max(0, Math.pow(volume, 2) * gain))
}

function setNormalization(loudnessDb: number | undefined) {
  normalization = loudnessDb && loudnessDb > 0 ? Math.max(0.1, Math.pow(10, -loudnessDb / 20)) : 1
  applyVolume()
}

async function loadStreamInfo(videoId: string) {
  try {
    const info = await window.aurora.streamInfo(videoId)
    if (usePlayer.getState().current()?.videoId !== videoId) return
    usePlayer.setState({ stream: info })
    setNormalization(info.loudnessDb)
  } catch {
    /* the label is optional */
  }
}

function updateMediaSession(song: Song | null) {
  if (!('mediaSession' in navigator)) return
  if (!song) {
    navigator.mediaSession.metadata = null
    return
  }
  const art = artworkAt(song.thumbnailUrl, PLAYER_ART_PX)
  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.title,
    artist: song.artist,
    album: song.albumName ?? '',
    artwork: art ? [{ src: art, sizes: `${PLAYER_ART_PX}x${PLAYER_ART_PX}`, type: 'image/jpeg' }] : [],
  })
}

function load(song: Song, autoplay: boolean, startMs = 0) {
  loadedVideoId = song.videoId
  usePlayer.setState({
    isLoading: true,
    stream: null,
    positionMs: startMs,
    durationMs: durationMillis(song.durationText),
    error: null,
  })
  updateMediaSession(song)
  if (spareFor === song.videoId) {
    // Already buffered on the spare element: swap and go, no gap.
    cur().pause()
    active = 1 - active
    spareFor = null
    cur().currentTime = startMs / 1000
  } else {
    cur().pause()
    pendingSeekMs = startMs
    cur().src = streamUrl(song.videoId)
    cur().load()
  }
  applyVolume()
  loadStreamInfo(song.videoId)
  if (autoplay) {
    cur()
      .play()
      .catch((e) => {
        if (e?.name !== 'AbortError') usePlayer.setState({ isPlaying: false, isLoading: false, error: String(e?.message ?? e) })
      })
  }
  prefetchNeighbours()
  topUpRadio()
}

function prefetchNeighbours() {
  const { songs, index } = usePlayer.getState()
  const next = songs[index + 1]
  if (next) window.aurora.prefetch(next.videoId)
}

function preloadSpare() {
  const { songs, index, repeat } = usePlayer.getState()
  const next = repeat === 'one' ? null : songs[index + 1]
  if (!next || spareFor === next.videoId) return
  spareFor = next.videoId
  spare().src = streamUrl(next.videoId)
  spare().load()
}

async function topUpRadio() {
  const s = usePlayer.getState()
  if (radioInFlight || !s.radio || !useSettings.getState().autoplay) return
  if (s.songs.length - 1 - s.index > RADIO_RUNWAY) return
  const seed = s.songs[s.songs.length - 1]
  if (!seed) return
  radioInFlight = true
  try {
    const up = await window.aurora.upNext(seed.videoId, s.radioPlaylistId)
    usePlayer.getState().appendRadio(up.songs, up.playlistId)
  } catch {
    usePlayer.setState({ radio: false })
  } finally {
    radioInFlight = false
  }
}

// ---- element events: whichever element is active drives the store ---------

elements.forEach((el) => {
  el.addEventListener('playing', () => {
    if (el !== cur()) return
    usePlayer.setState({ isPlaying: true, isLoading: false })
  })
  el.addEventListener('pause', () => {
    if (el !== cur()) return
    usePlayer.setState({ isPlaying: false })
  })
  el.addEventListener('waiting', () => {
    if (el === cur()) usePlayer.setState({ isLoading: true })
  })
  el.addEventListener('canplay', () => {
    if (el === cur()) usePlayer.setState({ isLoading: false })
  })
  el.addEventListener('loadedmetadata', () => {
    if (el !== cur()) return
    if (pendingSeekMs > 0) {
      el.currentTime = pendingSeekMs / 1000
      pendingSeekMs = 0
    }
    if (Number.isFinite(el.duration)) usePlayer.setState({ durationMs: el.duration * 1000 })
  })
  el.addEventListener('timeupdate', () => {
    if (el !== cur()) return
    usePlayer.setState({ positionMs: el.currentTime * 1000 })
    if (Number.isFinite(el.duration) && el.duration - el.currentTime < PRELOAD_LEAD_S) preloadSpare()
    if ('mediaSession' in navigator && Number.isFinite(el.duration) && el.duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: el.duration,
          position: Math.min(el.currentTime, el.duration),
          playbackRate: el.playbackRate,
        })
      } catch {
        /* position briefly past duration while ending */
      }
    }
  })
  el.addEventListener('ended', () => {
    if (el !== cur()) return
    usePlayer.getState().next(true)
  })
  el.addEventListener('error', () => {
    if (el !== cur() || !el.src) return
    usePlayer.setState({ isLoading: false, isPlaying: false, error: 'This track could not be played.' })
    // Skip what cannot play rather than stalling the queue (PlaybackFallback.kt).
    setTimeout(() => {
      const s = usePlayer.getState()
      if (s.error && s.current()?.videoId === loadedVideoId) s.next(true)
    }, 1500)
  })
})

// ---- store → engine ---------------------------------------------------------

usePlayer.subscribe((state, prev) => {
  const song = state.current()
  if (state.playToken !== loadedToken && song) {
    loadedToken = state.playToken
    if (song.videoId === loadedVideoId && state.positionMs === 0 && prev.playToken !== state.playToken) {
      // Same track asked for again (repeat-one, "previous" at the start): restart it.
      cur().currentTime = 0
      cur().play().catch(() => undefined)
    } else {
      load(song, true)
    }
  }
  if (state.volume !== prev.volume) applyVolume()
  if (state.songs !== prev.songs) {
    // The queue changed under the spare: drop a preload that is no longer next.
    const next = state.songs[state.index + 1]
    if (spareFor && next?.videoId !== spareFor) {
      spareFor = null
      spare().removeAttribute('src')
      spare().load()
    }
    topUpRadio()
  }
})

useSettings.subscribe((s, prev) => {
  if (s.normalizeVolume !== prev.normalizeVolume) applyVolume()
})

// ---- controls -----------------------------------------------------------------

export function togglePlay() {
  const s = usePlayer.getState()
  const song = s.current()
  if (!song) return
  if (loadedVideoId !== song.videoId) {
    // Restored queue: nothing loaded yet.
    loadedToken = s.playToken
    load(song, true, s.positionMs)
    return
  }
  if (cur().paused) cur().play().catch(() => undefined)
  else cur().pause()
}

export function seekTo(ms: number) {
  const el = cur()
  if (!Number.isFinite(el.duration)) {
    pendingSeekMs = ms
    usePlayer.setState({ positionMs: ms })
    return
  }
  el.currentTime = Math.max(0, Math.min(el.duration - 0.25, ms / 1000))
  usePlayer.setState({ positionMs: el.currentTime * 1000 })
}

export function previous() {
  if (getPositionMs() > RESTART_THRESHOLD_MS) seekTo(0)
  else usePlayer.getState().previous()
}

export function next() {
  usePlayer.getState().next()
}

if ('mediaSession' in navigator) {
  const ms = navigator.mediaSession
  ms.setActionHandler('play', () => togglePlay())
  ms.setActionHandler('pause', () => cur().pause())
  ms.setActionHandler('nexttrack', () => next())
  ms.setActionHandler('previoustrack', () => previous())
  ms.setActionHandler('seekto', (d) => d.seekTime != null && seekTo(d.seekTime * 1000))
  ms.setActionHandler('seekbackward', (d) => seekTo(getPositionMs() - (d.seekOffset ?? 10) * 1000))
  ms.setActionHandler('seekforward', (d) => seekTo(getPositionMs() + (d.seekOffset ?? 10) * 1000))
}

// ---- persistence: the queue survives a restart (LastPlayed.kt) -------------

let saveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSave() {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    const { songs, index, positionMs } = usePlayer.getState()
    if (songs.length) window.aurora.saveQueue({ songs: songs.slice(0, 500), index, positionMs })
  }, 2000)
}
usePlayer.subscribe((s, prev) => {
  if (s.songs !== prev.songs || s.index !== prev.index || Math.abs(s.positionMs - prev.positionMs) > 5000) scheduleSave()
})
window.addEventListener('beforeunload', () => {
  const { songs, index } = usePlayer.getState()
  if (songs.length) window.aurora.saveQueue({ songs: songs.slice(0, 500), index, positionMs: getPositionMs() })
})

export async function restoreQueue() {
  const saved = await window.aurora.loadQueue()
  if (!saved?.songs?.length) return
  usePlayer.getState().restore(saved.songs, saved.index, saved.positionMs)
  loadedToken = usePlayer.getState().playToken
  updateMediaSession(usePlayer.getState().current())
  const song = usePlayer.getState().current()
  if (song) usePlayer.setState({ durationMs: durationMillis(song.durationText) })
}

// Read-only handle for inspecting playback from DevTools.
;(window as unknown as { __aurora: unknown }).__aurora = {
  player: usePlayer,
  elements,
  get active() {
    return active
  },
}
