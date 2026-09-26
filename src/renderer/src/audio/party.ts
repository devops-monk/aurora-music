import type { PartyControl, PartyTrack, PartyView } from '@shared/api'
import { durationMillis, formatTime, isLocalId, type Song } from '@shared/models'
import { usePlayer, setRemoteControl, type RemoteControl } from '../store/player'
import { inParty, useParty } from '../store/party'
import { useUi } from '../store/ui'
import { getPositionMs, local, setTransportRemote } from './engine'

/**
 * Listen Together, the playback side (BitChord's `PartySync.kt`).
 *
 * In a party this device stops deciding what plays. Every user action becomes
 * a control frame; the server applies it and echoes the new state to everyone,
 * this device included, and the follower below makes local playback match:
 * same queue, same track, and the position the server says is true *now*
 * (positionMs + time since anchorMs, on the server's clock via the measured
 * offset). Drift beyond a small tolerance is corrected with a seek.
 */

const DRIFT_TOLERANCE_MS = 450
const FOLLOW_EVERY_MS = 500
const REPORT_EVERY_MS = 5000
const MAX_UPCOMING = 25

const toWire = (s: Song): PartyTrack => ({
  videoId: s.videoId,
  title: s.title,
  artist: s.artist,
  ...(s.thumbnailUrl && !s.thumbnailUrl.startsWith('aurora:') ? { thumbnailUrl: s.thumbnailUrl } : {}),
  ...(durationMillis(s.durationText) ? { durationMs: durationMillis(s.durationText) } : {}),
})

const fromWire = (t: PartyTrack): Song => ({
  videoId: t.videoId,
  title: t.title,
  artist: t.artist,
  thumbnailUrl: t.thumbnailUrl ?? null,
  durationText: t.durationMs ? formatTime(t.durationMs) : null,
})

const send = (control: PartyControl) => window.aurora.partyControl(control)
const shareable = (songs: Song[]) => songs.filter((s) => !isLocalId(s.videoId))
const refuseLocal = () => useUi.getState().showToast('Files on this computer can’t be shared in a party')

function view(): PartyView {
  return useParty.getState()
}

function serverNow(v: PartyView) {
  return Date.now() + v.offsetMs
}

/** Where the party says the playhead is right now. */
function targetPosition(v: PartyView): number {
  const p = v.playback!
  const elapsed = p.isPlaying ? Math.max(0, serverNow(v) - p.anchorMs) : 0
  const pos = p.positionMs + elapsed
  return p.track?.durationMs ? Math.min(pos, p.track.durationMs) : pos
}

const remote: RemoteControl = {
  playSongs(songs, startIndex) {
    const list = shareable(songs)
    const start = songs[startIndex]
    if (!start || isLocalId(start.videoId)) return refuseLocal()
    const index = Math.max(0, list.indexOf(start))
    const queue = list.slice(0, index + 1 + MAX_UPCOMING).map(toWire)
    // Queue first, then track: a state pointing at an index in a list nobody has is the bug to avoid.
    send({ action: 'setQueue', queue, queueIndex: index })
    send({ action: 'setTrack', track: queue[index], positionMs: 0, isPlaying: true, queueIndex: index })
  },
  playRadio(song) {
    if (isLocalId(song.videoId)) return refuseLocal()
    const track = toWire(song)
    send({ action: 'setQueue', queue: [track], queueIndex: 0 })
    send({ action: 'setTrack', track, positionMs: 0, isPlaying: true, queueIndex: 0 })
    // The person who started it seeds the party with that song's radio.
    window.aurora
      .upNext(song.videoId)
      .then((up) => {
        const more = up.songs.filter((s) => s.videoId !== song.videoId).slice(0, 15).map(toWire)
        if (more.length) send({ action: 'queueAdd', tracks: more })
      })
      .catch(() => undefined)
  },
  jumpTo(index) {
    const s = usePlayer.getState().songs[index]
    if (s) send({ action: 'setTrack', track: toWire(s), positionMs: 0, isPlaying: true, queueIndex: index })
  },
  next(auto) {
    if (!auto) return send({ action: 'next' })
    // Every device reaches the end together. Only advance if the party is still on the
    // track that ended, and name the destination, so two reports land on one song.
    const v = view()
    const { songs, index } = usePlayer.getState()
    const ended = songs[index]
    const nextSong = songs[index + 1]
    if (!v.playback?.track || !ended || v.playback.track.videoId !== ended.videoId || !nextSong) return
    send({ action: 'setTrack', track: toWire(nextSong), positionMs: 0, isPlaying: true, queueIndex: index + 1 })
  },
  previous() {
    send({ action: 'previous' })
  },
  playNext(song) {
    if (isLocalId(song.videoId)) return refuseLocal()
    send({ action: 'queueAdd', tracks: [toWire(song)], playNext: true })
    useUi.getState().showToast('Playing next for everyone')
  },
  addToQueue(song) {
    if (isLocalId(song.videoId)) return refuseLocal()
    send({ action: 'queueAdd', tracks: [toWire(song)] })
    useUi.getState().showToast('Added to the party queue')
  },
  removeAt(index) {
    const s = usePlayer.getState().songs[index]
    if (s) send({ action: 'queueRemove', videoId: s.videoId })
  },
  setUpcoming(upcoming) {
    const { songs, index } = usePlayer.getState()
    const queue = [...songs.slice(0, index + 1), ...shareable(upcoming)].slice(0, index + 1 + MAX_UPCOMING).map(toWire)
    send({ action: 'setQueue', queue, queueIndex: index })
  },
  appendRadio(songs) {
    // Autoplay top-ups come from the host only, or every device would add its own.
    if (!view().you?.isHost) return
    const { songs: have, index } = usePlayer.getState()
    const room = MAX_UPCOMING - (have.length - 1 - index)
    const fresh = shareable(songs).filter((s) => !have.some((h) => h.videoId === s.videoId)).slice(0, Math.max(0, room))
    if (fresh.length) send({ action: 'queueAdd', tracks: fresh.map(toWire) })
  },
}

// ---- following the party ------------------------------------------------------

let scheduledStart: ReturnType<typeof setTimeout> | null = null

function follow() {
  const v = view()
  if (!inParty(v) || !v.playback) return
  const p = v.playback
  const player = usePlayer.getState()

  // 1. The queue: mirror the party's list exactly.
  const items = v.queue?.items
  if (items?.length) {
    const ids = items.map((t) => t.videoId).join('|')
    if (player.songs.map((s) => s.videoId).join('|') !== ids) {
      const index = Math.min(Math.max(0, p.queueIndex), items.length - 1)
      const current = player.current()
      const sameTrack = current?.videoId === items[index]?.videoId
      usePlayer.setState((s) => ({
        songs: items.map(fromWire),
        index,
        original: null,
        source: `Listen Together · ${v.code}`,
        radio: true,
        // A different track than the one loaded means load it; same track, keep playing.
        playToken: sameTrack ? s.playToken : s.playToken + 1,
      }))
      return
    }
  }

  // 2. The track.
  if (!p.track) return
  const current = player.current()
  if (current?.videoId !== p.track.videoId) {
    const at = player.songs.findIndex((s) => s.videoId === p.track!.videoId)
    usePlayer.setState((s) =>
      at >= 0
        ? { index: at, playToken: s.playToken + 1, source: `Listen Together · ${v.code}` }
        : { songs: [fromWire(p.track!)], index: 0, playToken: s.playToken + 1, source: `Listen Together · ${v.code}` },
    )
    return
  }
  if (!local.isLoaded(p.track.videoId)) return

  // 3. Position and play state.
  const target = targetPosition(v)
  const now = serverNow(v)
  if (p.isPlaying && now < p.anchorMs) {
    // A resume scheduled a moment ahead so every device starts together.
    local.pause()
    local.seek(p.positionMs)
    if (!scheduledStart) {
      scheduledStart = setTimeout(() => {
        scheduledStart = null
        local.play()
      }, p.anchorMs - now)
    }
    return
  }
  if (Math.abs(getPositionMs() - target) > DRIFT_TOLERANCE_MS) local.seek(target)
  if (p.isPlaying && local.isPaused()) local.play()
  if (!p.isPlaying && !local.isPaused()) local.pause()
}

// ---- wiring -----------------------------------------------------------------------

function enter() {
  setRemoteControl(remote)
  setTransportRemote({
    play: (positionMs) => send({ action: 'play', positionMs: Math.round(positionMs) }),
    pause: (positionMs) => send({ action: 'pause', positionMs: Math.round(positionMs) }),
    seek: (positionMs) => send({ action: 'seek', positionMs: Math.round(positionMs) }),
  })
}

function exit() {
  setRemoteControl(null)
  setTransportRemote(null)
  if (scheduledStart) clearTimeout(scheduledStart)
  scheduledStart = null
}

export function startPartySync() {
  window.aurora.partyView().then((v) => useParty.setState(v, true))
  const off = window.aurora.onParty((v) => {
    const was = inParty()
    useParty.setState(v, true)
    const now = inParty(v)
    if (now && !was) enter()
    if (!now && was) exit()
    if (now) follow()
  })
  const followTimer = setInterval(follow, FOLLOW_EVERY_MS)
  const reportTimer = setInterval(() => {
    if (inParty()) window.aurora.partyReport(getPositionMs(), !local.isPaused())
  }, REPORT_EVERY_MS)
  return () => {
    off()
    clearInterval(followTimer)
    clearInterval(reportTimer)
    exit()
  }
}

/** Who this listener is to the party: the signed-in account, else a stable guest id. */
export function partyIdentity() {
  const account = useUi.getState().account
  let guest = ''
  try {
    guest = localStorage.getItem('aurora.guestId') ?? ''
    if (!guest) {
      guest = crypto.randomUUID()
      localStorage.setItem('aurora.guestId', guest)
    }
  } catch {
    guest = crypto.randomUUID()
  }
  return {
    userId: account?.email || account?.channelHandle || `aurora-guest:${guest}`,
    displayName: account?.name || 'Aurora listener',
    avatarUrl: account?.thumbnailUrl ?? null,
  }
}
