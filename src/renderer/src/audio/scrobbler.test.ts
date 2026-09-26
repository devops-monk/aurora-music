import { describe, expect, it, vi } from 'vitest'

vi.mock('./engine', () => ({ getPositionMs: () => 0 }))
vi.mock('../store/player', () => ({ usePlayer: { getState: () => ({ current: () => null }) } }))

const { shouldScrobble } = await import('./scrobbler')

describe('scrobble rule', () => {
  it('ignores tracks of 30 s or less', () => {
    expect(shouldScrobble(30_000, 30_000)).toBe(false)
  })
  it('scrobbles at half the track', () => {
    expect(shouldScrobble(99_000, 200_000)).toBe(false)
    expect(shouldScrobble(100_000, 200_000)).toBe(true)
  })
  it('never waits more than four minutes', () => {
    expect(shouldScrobble(240_000, 900_000)).toBe(true)
  })
})
