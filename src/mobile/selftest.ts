import { usePlayer } from '@renderer/store/player'
import { getPositionMs } from '@renderer/audio/engine'
import type { Song } from '@shared/models'

/**
 * A scripted smoke test for the phone builds, compiled in only when
 * VITE_AURORA_SELFTEST=1 (the iOS CI job). Each step logs one
 * "AURORA_SELFTEST {json}" line to the native console, and the UI is moved
 * to fixed places at fixed times so CI can take screenshots of them.
 */
const log = (step: string, data: unknown) => console.log('AURORA_SELFTEST ' + JSON.stringify({ step, ...(data as object) }))
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function step<T>(name: string, run: () => Promise<T>): Promise<T | null> {
  const start = performance.now()
  try {
    const value = await run()
    log(name, { ok: true, ms: Math.round(performance.now() - start), value })
    return value
  } catch (e) {
    log(name, { ok: false, ms: Math.round(performance.now() - start), error: String((e as Error)?.message ?? e) })
    return null
  }
}

async function run() {
  const A = window.aurora
  const started = performance.now()
  const at = (s: number) => wait(Math.max(0, started + s * 1000 - performance.now()))
  log('start', { platform: A.platform, ua: navigator.userAgent })

  await step('home', async () => (await A.home()).shelves.map((s) => `${s.title} (${s.items.length})`))
  const found = await step('search', async () => {
    const r = await A.search('Anti-Hero Taylor Swift', 'songs')
    const songs = Object.values(r).filter(Array.isArray).flat() as { song?: Song; videoId?: string }[]
    const song = songs.map((x) => x.song ?? (x as Song)).find((s) => s?.videoId)
    if (!song) throw new Error('no song')
    return { title: song.title, artist: song.artist, videoId: song.videoId, album: song.albumName }
  })
  const song = found as unknown as Song | null
  if (!song) return log('done', { ok: false })

  await step('stream', async () => {
    const url = await A.streamSrc!(song.videoId)
    return { token: url.includes('pot='), mime: new URL(url).searchParams.get('mime') }
  })
  await step('lyrics', async () => {
    const info = await A.streamInfo(song.videoId)
    const l = await A.lyrics(song, info.durationMs ?? 0)
    return l ? { source: l.source, synced: l.synced, lines: l.lines.length } : null
  })
  await step('motion', async () => ((await A.motionForAlbum('Midnights', 'Taylor Swift')) ? 'found' : 'none'))

  await step('play', async () => {
    usePlayer.getState().playSongs([song], 0, { source: 'Self-test' })
    await wait(15_000)
    const s = usePlayer.getState()
    return { positionMs: Math.round(getPositionMs()), isPlaying: s.isPlaying, error: s.error }
  })
  await step('images', async () => {
    const imgs = [...document.querySelectorAll('img')]
    return {
      total: imgs.length,
      loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
      failed: imgs.filter((i) => i.complete && i.naturalWidth === 0).length,
      placeholders: document.querySelectorAll('.artwork-placeholder').length,
    }
  })

  // Screens for CI's screenshots: Now Playing at 60 s, lyrics at 75 s.
  await at(55)
  usePlayer.getState().openNowPlaying()
  log('screen', { now: 'nowplaying' })
  await at(70)
  usePlayer.getState().setPane('lyrics')
  log('screen', { now: 'lyrics' })

  // Keep reporting the position; CI sends the app to the background meanwhile.
  for (let i = 0; i < 24; i++) {
    await wait(5000)
    log('position', { positionMs: Math.round(getPositionMs()), visibility: document.visibilityState, isPlaying: usePlayer.getState().isPlaying })
  }
  log('done', { ok: true })
}

setTimeout(run, 3000)
