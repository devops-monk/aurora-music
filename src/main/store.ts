import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_SETTINGS, type SavedQueue, type Settings } from '@shared/api'

/**
 * Small JSON files in userData, written atomically (temp file + rename) so a
 * crash mid-write never leaves a half-written settings file behind.
 */
function file(name: string) {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, name)
}

function readJson<T>(name: string): T | null {
  try {
    return JSON.parse(readFileSync(file(name), 'utf8')) as T
  } catch {
    return null
  }
}

function writeJson(name: string, value: unknown) {
  const path = file(name)
  writeFileSync(path + '.tmp', JSON.stringify(value))
  renameSync(path + '.tmp', path)
}

let settings: Settings | null = null

export function getSettings(): Settings {
  settings ??= { ...DEFAULT_SETTINGS, ...(readJson<Partial<Settings>>('settings.json') ?? {}) }
  return settings
}

export function setSettings(patch: Partial<Settings>): Settings {
  settings = { ...getSettings(), ...patch }
  writeJson('settings.json', settings)
  return settings
}

export const saveQueue = (q: SavedQueue) => writeJson('queue.json', q)
export const loadQueue = () => readJson<SavedQueue>('queue.json')

/**
 * The YouTube Music cookie, encrypted with the OS keychain (Keychain on macOS,
 * DPAPI on Windows, libsecret/kwallet on Linux) — the desktop `EncryptedPrefs`.
 */
export function loadCookie(): string | null {
  try {
    const buf = readFileSync(file('session.bin'))
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : null
  } catch {
    return null
  }
}

export function saveCookie(cookie: string | null) {
  if (!cookie) {
    try {
      writeFileSync(file('session.bin'), '')
    } catch {
      /* nothing to clear */
    }
    return
  }
  if (!safeStorage.isEncryptionAvailable()) return
  writeFileSync(file('session.bin'), safeStorage.encryptString(cookie))
}
