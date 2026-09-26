import { describe, expect, it } from 'vitest'
import type { Song } from '@shared/models'
import { appendUnique, insertNext, move, removeAt, shuffled, unshuffled } from './queue'

const song = (id: string): Song => ({ videoId: id, title: id, artist: '', thumbnailUrl: null })
const ids = (q: { songs: Song[] }) => q.songs.map((s) => s.videoId)
const q = (list: string, index = 0) => ({ songs: list.split('').map(song), index })

describe('queue', () => {
  it('shuffle keeps the current track first and loses nothing', () => {
    const out = shuffled(q('abcdef', 2), () => 0.5)
    expect(out.index).toBe(0)
    expect(out.songs[0].videoId).toBe('c')
    expect(ids(out).sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })

  it('unshuffle restores order and keeps the current track current', () => {
    const original = q('abcde').songs
    const out = unshuffled({ songs: [original[3], original[0], original[4]], index: 0 }, original)
    expect(ids(out)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(out.index).toBe(3)
  })

  it('insertNext goes straight after the current track', () => {
    expect(ids(insertNext(q('abc', 1), song('x')))).toEqual(['a', 'b', 'x', 'c'])
  })

  it('removeAt never removes the current track and keeps the index right', () => {
    expect(removeAt(q('abc', 1), 1)).toEqual(q('abc', 1))
    const out = removeAt(q('abcd', 2), 0)
    expect(ids(out)).toEqual(['b', 'c', 'd'])
    expect(out.index).toBe(1)
  })

  it('move tracks the current track wherever it ends up', () => {
    expect(move(q('abcd', 1), 1, 3).index).toBe(3)
    expect(move(q('abcd', 1), 0, 2).index).toBe(0)
    expect(move(q('abcd', 1), 3, 0).index).toBe(2)
  })

  it('appendUnique skips anything already queued', () => {
    const base = q('ab')
    expect(ids(appendUnique(base, [song('b'), song('c'), song('c')]))).toEqual(['a', 'b', 'c'])
    expect(appendUnique(base, [song('a')])).toBe(base)
  })
})
