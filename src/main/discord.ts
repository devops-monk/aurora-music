import { Client } from '@xhayper/discord-rpc'
import { artworkAt, isLocalId, type Song } from '@shared/models'
import type { PresenceUpdate } from '@shared/api'
import { getSettings } from './store'

/**
 * Discord status through Discord's own local RPC (the desktop client's IPC
 * socket), under a Discord Application the user or the build supplies. Not a
 * port of BitChord's approach, which logs in with the user's account token over
 * the gateway: that is self-botting, against Discord's terms.
 *
 * Shows "Listening to Aurora Music" with the track, artist, cover and a live
 * progress bar, and a button to open the song. Paused clears the status.
 */

const ACTIVITY_LISTENING = 2
const STATUS_DISPLAY_DETAILS = 2
const RETRY_MS = 30_000

let client: Client | null = null
let connecting: Promise<Client | null> | null = null
let clientIdInUse = ''
let retryAfter = 0
let last: PresenceUpdate | null = null

export const buildClientId = () => import.meta.env.MAIN_VITE_DISCORD_CLIENT_ID ?? ''
const clientId = () => getSettings().discordClientId.trim() || buildClientId()

async function connect(): Promise<Client | null> {
  const id = clientId()
  if (!id || !getSettings().discordEnabled) return null
  if (client && clientIdInUse === id && client.isConnected) return client
  if (Date.now() < retryAfter) return null
  connecting ??= (async () => {
    try {
      await client?.destroy().catch(() => undefined)
      const c = new Client({ clientId: id, transport: { type: 'ipc' } })
      c.on('disconnected', () => {
        if (client === c) client = null
      })
      await c.connect()
      client = c
      clientIdInUse = id
      return c
    } catch {
      // Discord isn't running (or the id is wrong): try again later, quietly.
      retryAfter = Date.now() + RETRY_MS
      client = null
      return null
    } finally {
      connecting = null
    }
  })()
  return connecting
}

function activityFor(song: Song, positionMs: number, durationMs: number) {
  const art = isLocalId(song.videoId) ? null : artworkAt(song.thumbnailUrl, 512)
  const now = Date.now()
  const start = now - positionMs
  return {
    type: ACTIVITY_LISTENING,
    statusDisplayType: STATUS_DISPLAY_DETAILS,
    details: song.title.slice(0, 128),
    state: (song.artist || 'Unknown artist').slice(0, 128),
    ...(art ? { largeImageUrl: art, largeImageText: (song.albumName || song.title).slice(0, 128) } : {}),
    startTimestamp: start,
    ...(durationMs > 0 ? { endTimestamp: start + durationMs } : {}),
    ...(isLocalId(song.videoId)
      ? {}
      : { buttons: [{ label: 'Listen on YouTube Music', url: `https://music.youtube.com/watch?v=${song.videoId}` }] }),
  }
}

export async function updatePresence(update: PresenceUpdate | null) {
  last = update
  const c = await connect()
  if (!c?.user) return
  try {
    if (!update || !update.playing || !getSettings().discordEnabled) await c.user.clearActivity()
    else await c.user.setActivity(activityFor(update.song, update.positionMs, update.durationMs))
  } catch {
    client = null
  }
}

/** Settings changed: drop the old connection and republish what is playing. */
export async function refreshPresence() {
  retryAfter = 0
  if (!getSettings().discordEnabled || clientIdInUse !== clientId()) {
    await client?.user?.clearActivity().catch(() => undefined)
    await client?.destroy().catch(() => undefined)
    client = null
  }
  if (getSettings().discordEnabled) await updatePresence(last)
}

export const discordConnected = () => !!client?.isConnected
