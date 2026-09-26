import { BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'
import type { PartyControl, PartyIdentity, PartyPlayback, PartyQueue, PartyView } from '@shared/api'
import { getSecret, getSettings, setSecret } from './store'

/**
 * Listen Together: a client for the party server protocol that BitChord's
 * backend defines (see its backend/README.md), so Aurora and BitChord devices
 * pointed at the same server can share a party.
 *
 * The socket lives here, not in the page, because the protocol authenticates
 * the WebSocket handshake with an Authorization header, which the browser
 * WebSocket API cannot send. The renderer receives a PartyView and decides what
 * to play; this module only keeps the connection, the clock and the truth.
 *
 * Sync rule (server README, "How devices stay in time"): the server states a
 * position and the server instant it was true at; with a measured clock offset
 * each device computes where it should be *now* locally.
 */

const PING_FAST_MS = 1500
const PING_SLOW_MS = 15_000
const FAST_PINGS = 6
const RECONNECT_MAX_MS = 15_000

let view: PartyView = { status: 'idle', members: [], maxMembers: 5, hostOnlyControl: false, offsetMs: 0 }
let ws: WebSocket | null = null
let token: string | null = null
let server = ''
let bestRtt = Infinity
let pingTimer: ReturnType<typeof setTimeout> | null = null
let pingsSent = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectDelay = 1000
let leaving = false

export const defaultServer = () => (import.meta.env.MAIN_VITE_PARTY_SERVER ?? '').trim()
const base = () => (getSettings().partyServer.trim() || defaultServer()).replace(/\/+$/, '')

function emit(patch: Partial<PartyView>) {
  view = { ...view, ...patch }
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('aurora:party', view)
}

export const partyView = () => view

/** A stable per-install device id, as the server counts slots per device. */
function deviceId(): string {
  let id = getSecret('party.deviceId')
  if (!id) {
    id = randomUUID()
    setSecret('party.deviceId', id)
  }
  return id
}

async function rest(path: string, body?: unknown, auth = false) {
  const res = await fetch(`${server}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const code = String(json.error ?? res.status)
    const friendly: Record<string, string> = {
      '404': 'No party with that code.',
      not_found: 'No party with that code.',
      '409': 'That party is full.',
      party_full: 'That party is full.',
      rate_limited: 'Too many parties created from here. Try again in a minute.',
    }
    throw new Error(friendly[code] ?? String(json.message ?? `Server error (${res.status})`))
  }
  return json
}

function identity(who: PartyIdentity) {
  return {
    userId: who.userId,
    deviceId: deviceId(),
    displayName: who.displayName.slice(0, 64) || 'Aurora listener',
    ...(who.avatarUrl ? { avatarUrl: who.avatarUrl } : {}),
  }
}

function applySnapshot(party: Record<string, unknown>) {
  const queue = party.queue as PartyQueue | undefined
  emit({
    code: String(party.code ?? view.code),
    members: (party.members as PartyView['members']) ?? view.members,
    maxMembers: Number(party.maxMembers ?? view.maxMembers),
    hostOnlyControl: Boolean(party.hostOnlyControl ?? false),
    ...(party.playback ? { playback: party.playback as PartyPlayback } : {}),
    ...(queue ? { queue } : {}),
  })
}

export async function createParty(who: PartyIdentity): Promise<PartyView> {
  server = base()
  if (!server) throw new Error('Set a Listen Together server address first.')
  const res = await rest('/api/parties', identity(who))
  return enter(res)
}

export async function joinParty(code: string, who: PartyIdentity): Promise<PartyView> {
  server = base()
  if (!server) throw new Error('Set a Listen Together server address first.')
  const res = await rest(`/api/parties/${encodeURIComponent(code.trim())}/join`, identity(who))
  return enter(res)
}

function enter(res: Record<string, unknown>): PartyView {
  token = String(res.token)
  leaving = false
  bestRtt = Infinity
  emit({ status: 'connecting', error: undefined, you: res.you as PartyView['you'], code: String(res.code) })
  applySnapshot(res.party as Record<string, unknown>)
  connect()
  return view
}

function connect() {
  if (!token || !view.code) return
  ws?.removeAllListeners()
  ws?.close()
  const url = server.replace(/^http/, 'ws') + `/ws/parties/${encodeURIComponent(view.code)}`
  const socket = new WebSocket(url, { headers: { Authorization: `Bearer ${token}` } })
  ws = socket
  socket.on('open', () => {
    reconnectDelay = 1000
    pingsSent = 0
    emit({ status: 'connected', error: undefined })
    schedulePing(0)
  })
  socket.on('message', (data) => {
    let frame: Record<string, unknown>
    try {
      frame = JSON.parse(String(data))
    } catch {
      return
    }
    onFrame(frame)
  })
  socket.on('close', () => {
    if (ws !== socket) return
    stopPing()
    if (leaving || !token) return
    // A dropped socket is not a departure: the server holds the slot for its grace period.
    emit({ status: 'reconnecting' })
    reconnectTimer = setTimeout(connect, reconnectDelay)
    reconnectDelay = Math.min(RECONNECT_MAX_MS, reconnectDelay * 2)
  })
  socket.on('error', () => {
    /* 'close' follows and handles it */
  })
}

function send(frame: object) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame))
}

function schedulePing(delay: number) {
  stopPing()
  pingTimer = setTimeout(() => {
    send({ type: 'ping', clientMs: Date.now() })
    pingsSent++
    schedulePing(pingsSent < FAST_PINGS ? PING_FAST_MS : PING_SLOW_MS)
  }, delay)
}

function stopPing() {
  if (pingTimer) clearTimeout(pingTimer)
  pingTimer = null
}

function onFrame(frame: Record<string, unknown>) {
  switch (frame.type) {
    case 'welcome':
      emit({ you: frame.you as PartyView['you'] })
      applySnapshot(frame.party as Record<string, unknown>)
      break
    case 'pong': {
      // NTP-style: the sample with the smallest round trip bounds the error best.
      const t1 = Date.now()
      const t0 = Number(frame.clientMs)
      const rtt = t1 - t0
      if (rtt >= 0 && rtt <= bestRtt) {
        bestRtt = rtt
        emit({ offsetMs: Number(frame.serverMs) - (t0 + t1) / 2, rttMs: rtt })
      }
      break
    }
    case 'state': {
      const playback = frame.playback as PartyPlayback
      // Only strictly newer states apply; two simultaneous controls settle rather than oscillate.
      if (view.playback && playback.seq <= view.playback.seq) break
      emit({ playback })
      if (view.queue && playback.queueSeq !== view.queue.seq) send({ type: 'syncQueue' })
      break
    }
    case 'queue':
      emit({ queue: frame.queue as PartyQueue })
      break
    case 'members':
      emit({
        members: frame.members as PartyView['members'],
        maxMembers: Number(frame.maxMembers ?? view.maxMembers),
        hostOnlyControl: Boolean(frame.hostOnlyControl ?? false),
        you: (frame.members as PartyView['members']).find((m) => m.memberId === view.you?.memberId) ?? view.you,
      })
      break
    case 'error':
      emit({ error: String(frame.message ?? frame.error) })
      break
    case 'bye':
      reset(frame.reason === 'kicked' ? 'You were removed from the party.' : undefined)
      break
  }
}

export function partyControl(control: PartyControl) {
  send({ type: 'control', ...control })
}

export function partyReport(positionMs: number, isPlaying: boolean) {
  send({ type: 'report', positionMs: Math.round(positionMs), isPlaying })
}

function reset(error?: string) {
  leaving = true
  token = null
  stopPing()
  if (reconnectTimer) clearTimeout(reconnectTimer)
  ws?.removeAllListeners()
  ws?.close()
  ws = null
  view = { status: 'idle', members: [], maxMembers: 5, hostOnlyControl: false, offsetMs: 0, error }
  emit({})
}

export async function leaveParty() {
  if (token && view.code) await rest(`/api/parties/${encodeURIComponent(view.code)}/leave`, {}, true).catch(() => undefined)
  reset()
}

/** Checks a server address before saving it. */
export async function probeServer(address: string): Promise<boolean> {
  try {
    const res = await fetch(`${address.trim().replace(/\/+$/, '')}/healthz`, { signal: AbortSignal.timeout(35_000) })
    return res.ok
  } catch {
    return false
  }
}
