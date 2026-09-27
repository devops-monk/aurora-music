import { Buffer } from 'buffer'
import html from '../../resources/po_token.html?raw'
import { BotGuard } from './native'

/**
 * BotGuard PO tokens on Android, the desktop potoken.ts with the hidden page
 * moved into a native WebView at www.youtube.com (as NewPipe does). The two
 * jnn/v1 calls go through the native HTTP stack; the page only computes.
 */

const GOOGLE_API_KEY = 'AIzaSyDyT5W0Jh49F30Pqqtyfdf7pDLFKLJoAnw'
const REQUEST_KEY = 'O43z0dpjhgX20SCx4KAo'
const EXPIRY_MARGIN_MS = 10 * 60_000

const b64decode = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/').replace(/\./g, '='), 'base64')
const b64url = (bytes: number[]) => Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_')

async function jnn(endpoint: 'Create' | 'GenerateIT', body: unknown[]): Promise<unknown[]> {
  const res = await fetch(`https://www.youtube.com/api/jnn/v1/${endpoint}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json+protobuf',
      'x-goog-api-key': GOOGLE_API_KEY,
      'x-user-agent': 'grpc-web-javascript/0.1',
    },
  })
  if (!res.ok) throw new Error(`BotGuard ${endpoint} failed: HTTP ${res.status}`)
  return (await res.json()) as unknown[]
}

function parseChallenge(raw: unknown[]) {
  const data = (
    raw.length > 1 && typeof raw[1] === 'string'
      ? JSON.parse(Buffer.from(b64decode(raw[1]).map((b) => (b + 97) & 0xff)).toString('utf8'))
      : raw[0]
  ) as unknown[]
  const scripts = (data[1] as unknown[] | null) ?? []
  return {
    interpreterJavascript: {
      privateDoNotAccessOrElseSafeScriptWrappedValue: scripts.find((x) => typeof x === 'string') ?? null,
    },
    program: data[4],
    globalName: data[5],
  }
}

/** BotGuard answers in well under a second once loaded; anything slower is stuck. */
const STEP_TIMEOUT_MS = 20_000

function withTimeout<T>(promise: Promise<T>, what: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`BotGuard ${what} timed out`)), STEP_TIMEOUT_MS)),
  ])
}

const evaluate = async <T>(script: string): Promise<T> =>
  JSON.parse((await withTimeout(BotGuard.evaluate({ script }), 'evaluate')).json) as T

let expiresAt = 0
let ready: Promise<void> | null = null

async function createMinter() {
  await withTimeout(BotGuard.load({ html, baseUrl: 'https://www.youtube.com/' }), 'page load')
  const challenge = parseChallenge(await jnn('Create', [REQUEST_KEY]))
  const botguardResponse = await evaluate<string>(
    `runBotGuard(${JSON.stringify(challenge)}).then(r => { window.webPoSignalOutput = r.webPoSignalOutput; return r.botguardResponse })`,
  )
  const it = await jnn('GenerateIT', [REQUEST_KEY, botguardResponse])
  const token = [...b64decode(String(it[0]))]
  await evaluate(`createPoTokenMinter(webPoSignalOutput, new Uint8Array(${JSON.stringify(token)})).then(() => true)`)
  expiresAt = Date.now() + (Number(it[1]) || 3600) * 1000 - EXPIRY_MARGIN_MS
}

function minter(forceNew = false): Promise<void> {
  if (forceNew || !ready || Date.now() > expiresAt) {
    ready = createMinter()
    ready.catch(() => (ready = null))
  }
  return ready
}

const cache = new Map<string, string>()

export async function poToken(identifier: string): Promise<string> {
  const hit = cache.get(identifier)
  if (hit) return hit
  const mint = () => evaluate<number[]>(`obtainPoToken(new TextEncoder().encode(${JSON.stringify(identifier)})).then(u => Array.from(u))`)
  let bytes: number[]
  try {
    await minter()
    bytes = await mint()
  } catch {
    cache.clear()
    await minter(true)
    bytes = await mint()
  }
  const token = b64url(bytes)
  if (cache.size > 500) cache.clear()
  cache.set(identifier, token)
  return token
}

export function warmUpPoToken() {
  minter().catch((e) => console.warn('[potoken] warm-up failed:', e?.message))
}
