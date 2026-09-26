import { BrowserWindow, session } from 'electron'
import { saveCookie } from './store'

/**
 * Google sign-in, the desktop `YtMusicLoginScreen.kt`: a real browser window
 * on accounts.google.com in its own persistent partition. Once it lands back on
 * music.youtube.com with a SAPISID cookie, that cookie jar is the session, and
 * it is stored encrypted and handed to youtubei.js, which signs requests with
 * SAPISIDHASH itself.
 */

const PARTITION = 'persist:ytm-auth'
const LOGIN_URL =
  'https://accounts.google.com/ServiceLogin?ltmpl=music&service=youtube&passive=true&continue=' +
  encodeURIComponent('https://www.youtube.com/signin?action_handle_signin=true&next=https%3A%2F%2Fmusic.youtube.com%2F')

async function cookieHeader(): Promise<string | null> {
  const cookies = await session.fromPartition(PARTITION).cookies.get({ domain: '.youtube.com' })
  if (!cookies.some((c) => c.name === 'SAPISID' || c.name === '__Secure-3PAPISID')) return null
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ')
}

export function signIn(parent: BrowserWindow | null): Promise<boolean> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 480,
      height: 680,
      parent: parent ?? undefined,
      modal: process.platform !== 'darwin' && !!parent,
      title: 'Sign in to YouTube Music',
      autoHideMenuBar: true,
      webPreferences: { partition: PARTITION, sandbox: true, contextIsolation: true, nodeIntegration: false },
    })
    // Google refuses sign-in from embedded browsers it recognises; a plain desktop Chrome UA is what it expects.
    win.webContents.setUserAgent(
      win.webContents.getUserAgent().replace(/ Electron\/[\d.]+/, '').replace(/ aurora-music\/[\d.]+/, ''),
    )
    let done = false
    const finish = async (ok: boolean) => {
      if (done) return
      done = true
      if (ok) saveCookie(await cookieHeader())
      if (!win.isDestroyed()) win.close()
      resolve(ok)
    }
    win.webContents.on('did-navigate', async (_e, url) => {
      if (new URL(url).hostname === 'music.youtube.com' && (await cookieHeader())) finish(true)
    })
    win.on('closed', () => finish(false))
    win.loadURL(LOGIN_URL)
  })
}

export async function signOut() {
  saveCookie(null)
  await session.fromPartition(PARTITION).clearStorageData()
}
