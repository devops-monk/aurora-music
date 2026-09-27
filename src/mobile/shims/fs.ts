/**
 * The few `node:fs` calls the shared main modules make (settings, queue,
 * Replay's play log), kept in the WebView's localStorage under their path.
 * Directories are implicit.
 */
const KEY = (path: string) => 'fs:' + path

const text = (data: unknown) => (typeof data === 'string' ? data : String(data))

export function existsSync(path: string): boolean {
  return path.endsWith('/') || !path.includes('.') || localStorage.getItem(KEY(path)) !== null
}

export function mkdirSync(): void {}

export function readFileSync(path: string): string {
  const value = localStorage.getItem(KEY(path))
  if (value === null) throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' })
  return value
}

export function writeFileSync(path: string, data: unknown): void {
  localStorage.setItem(KEY(path), text(data))
}

export function appendFileSync(path: string, data: unknown): void {
  localStorage.setItem(KEY(path), (localStorage.getItem(KEY(path)) ?? '') + text(data))
}

export function renameSync(from: string, to: string): void {
  const value = localStorage.getItem(KEY(from))
  if (value === null) return
  localStorage.setItem(KEY(to), value)
  localStorage.removeItem(KEY(from))
}

export default { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, renameSync }
