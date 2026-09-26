import { app, BrowserWindow } from 'electron'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Mints BotGuard "PO tokens". The approach, `po_token.html` and the
 * challenge parsing come from NewPipe's `PoTokenWebView` (GPLv3), whose
 * BotGuard client follows LuanRT's BgUtils (MIT); see NOTICE.md.
 *
 * Without one, googlevideo serves the first ~0.5–1 MB of any audio stream and
 * answers 403 to every range after it, so a track plays for a few seconds and
 * stops. The YTMUSIC client with a token bound to the video id, sent on both the
 * player request and the stream URL, is what unlocks the whole file.
 *
 * BotGuard has to run in a real browser. NewPipe uses a hidden WebView; here it
 * is a hidden, sandboxed BrowserWindow at the youtube.com origin, running the
 * same `po_token.html`. The main process makes the two `jnn/v1` calls, and the
 * page only ever computes.
 */

const GOOGLE_API_KEY = 'AIzaSyDyT5W0Jh49F30Pqqtyfdf7pDLFKLJoAnw'
const REQUEST_KEY = 'O43z0dpjhgX20SCx4KAo'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
/** Re-create the minter this long before the integrity token actually expires. */
const EXPIRY_MARGIN_MS = 10 * 60_000

const b64decode = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/').replace(/\./g, '='), 'base64')
const b64url = (bytes: number[]) => Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_')

async function jnn(endpoint: 'Create' | 'GenerateIT', body: unknown[]): Promise<unknown[]> {
  const res = await fetch(`https://www.youtube.com/api/jnn/v1/${endpoint}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      'Content-Type': 'application/json+protobuf',
      'x-goog-api-key': GOOGLE_API_KEY,
      'x-user-agent': 'grpc-web-javascript/0.1',
    },
  })
  if (!res.ok) throw new Error(`BotGuard ${endpoint} failed: HTTP ${res.status}`)
  return (await res.json()) as unknown[]
}

/** NewPipe's `parseChallengeData`: the challenge is sometimes scrambled (+97 per byte). */
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

class Minter {
  private constructor(
    private readonly win: BrowserWindow,
    readonly expiresAt: number,
  ) {}

  static async create(): Promise<Minter> {
    const win = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
    })
    try {
      const html = readFileSync(join(app.getAppPath(), 'resources/po_token.html'), 'utf8')
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html), {
        baseURLForDataURL: 'https://www.youtube.com/',
      })
      const challenge = parseChallenge(await jnn('Create', [REQUEST_KEY]))
      const botguardResponse: string = await win.webContents.executeJavaScript(
        `runBotGuard(${JSON.stringify(challenge)}).then(r => { window.webPoSignalOutput = r.webPoSignalOutput; return r.botguardResponse })`,
      )
      const it = await jnn('GenerateIT', [REQUEST_KEY, botguardResponse])
      const token = [...b64decode(String(it[0]))]
      const ttlSeconds = Number(it[1]) || 3600
      await win.webContents.executeJavaScript(
        `createPoTokenMinter(webPoSignalOutput, new Uint8Array(${JSON.stringify(token)}))`,
      )
      return new Minter(win, Date.now() + ttlSeconds * 1000 - EXPIRY_MARGIN_MS)
    } catch (e) {
      win.destroy()
      throw e
    }
  }

  get usable() {
    return !this.win.isDestroyed() && !this.win.webContents.isCrashed() && Date.now() < this.expiresAt
  }

  async mint(identifier: string): Promise<string> {
    const bytes: number[] = await this.win.webContents.executeJavaScript(
      `obtainPoToken(new TextEncoder().encode(${JSON.stringify(identifier)})).then(u => Array.from(u))`,
    )
    return b64url(bytes)
  }

  close() {
    if (!this.win.isDestroyed()) this.win.destroy()
  }
}

let minter: Promise<Minter> | null = null

async function currentMinter(forceNew = false): Promise<Minter> {
  if (minter && !forceNew) {
    const m = await minter.catch(() => null)
    if (m?.usable) return m
    m?.close()
  } else if (minter) {
    ;(await minter.catch(() => null))?.close()
  }
  minter = Minter.create()
  minter.catch(() => (minter = null))
  return minter
}

const cache = new Map<string, string>()

/** A PO token bound to [identifier] (a video id), minted once per identifier per minter. */
export async function poToken(identifier: string): Promise<string> {
  const hit = cache.get(identifier)
  if (hit) return hit
  let token: string
  try {
    token = await (await currentMinter()).mint(identifier)
  } catch {
    // The page may have been torn down (sleep, GPU reset): one retry from scratch.
    cache.clear()
    token = await (await currentMinter(true)).mint(identifier)
  }
  if (cache.size > 500) cache.clear()
  cache.set(identifier, token)
  return token
}

/** Starts BotGuard early so the first play does not pay for it. */
export function warmUpPoToken() {
  currentMinter().catch((e) => console.warn('[potoken] warm-up failed:', e?.message))
}
