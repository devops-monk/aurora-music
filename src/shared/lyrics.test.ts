import { describe, expect, it } from 'vitest'
import { activeLineIndex, baseTitle, cleanQuery, parseLrc, parseTtml, ttmlTime } from './lyrics'
import { durationMillis, formatTime, primaryArtist } from './models'

describe('parseLrc', () => {
  it('parses stamps with two- and three-digit fractions, sorted', () => {
    const lines = parseLrc('[00:12.50]second\n[00:05.123]first\nno stamp here')
    expect(lines.map((l) => [l.start, l.text])).toEqual([
      [0, ''],
      [5123, 'first'],
      [12500, 'second'],
    ])
  })

  it('fills each end from the next start', () => {
    const lines = parseLrc('[00:01.00]a\n[00:03.00]b')
    expect(lines[0].end).toBe(3000)
  })

  it('reads enhanced LRC word stamps', () => {
    const [line] = parseLrc('[00:01.00]<00:01.00>Hello <00:01.50>world<00:02.00>')
    expect(line.text).toBe('Hello world')
    expect(line.words).toEqual([
      { start: 1000, end: 1500, text: 'Hello' },
      { start: 1500, end: 2000, text: 'world' },
    ])
  })

  it('drops a short instrumental gap but keeps a long one', () => {
    const short = parseLrc('[00:01.00]a\n[00:02.00]\n[00:03.00]b')
    expect(short.map((l) => l.text)).toEqual(['a', 'b'])
    const long = parseLrc('[00:01.00]a\n[00:02.00]\n[00:09.00]b')
    expect(long.map((l) => l.text)).toEqual(['a', '', 'b'])
  })

  it('does not add a lead-in gap for an early first line', () => {
    expect(parseLrc('[00:00.50]early')[0].text).toBe('early')
  })
})

describe('ttml', () => {
  it('reads clock values', () => {
    expect(ttmlTime('12.5s')).toBe(12500)
    expect(ttmlTime('1:02.5')).toBe(62500)
    expect(ttmlTime('00:01:02.500')).toBe(62500)
    expect(ttmlTime('1500ms')).toBe(1500)
    expect(ttmlTime('nope')).toBeNull()
  })

  it('merges syllables into words and splits background vocals', () => {
    const ttml = `<tt><head><metadata><ttm:agent type="person" xml:id="v1"/></metadata></head><body><div>
      <p begin="1.0" end="3.0" ttm:agent="v1"><span begin="1.0" end="1.4">Hel</span><span begin="1.4" end="1.8">lo</span> <span begin="2.0" end="2.5">there</span><span ttm:role="x-bg"><span begin="2.6" end="3.0">(oh)</span></span></p>
    </div></body></tt>`
    const lines = parseTtml(ttml)
    expect(lines[0].text).toBe('Hello there')
    expect(lines[0].words?.[0]).toEqual({ start: 1000, end: 1800, text: 'Hello' })
    expect(lines[1]).toMatchObject({ background: true, text: '(oh)' })
  })

  it('puts the second singer of a duet on the other side', () => {
    const ttml = `<tt><head><metadata><ttm:agent type="person" xml:id="v1"/><ttm:agent type="person" xml:id="v2"/></metadata></head><body>
      <p begin="1" end="2" ttm:agent="v1"><span begin="1" end="2">one</span></p>
      <p begin="2" end="3" ttm:agent="v2"><span begin="2" end="3">two</span></p></body></tt>`
    const [a, b] = parseTtml(ttml)
    expect(a.oppositeTurn).toBeUndefined()
    expect(b.oppositeTurn).toBe(true)
  })

  it('decodes entities', () => {
    const [line] = parseTtml('<tt><body><p begin="1" end="2"><span begin="1" end="2">rock &amp; roll</span></p></body></tt>')
    expect(line.text).toBe('rock & roll')
  })
})

describe('helpers', () => {
  it('finds the active line, ignoring background vocals', () => {
    const lines = [
      { start: 0, end: 1000, text: 'a' },
      { start: 1000, end: 2000, text: 'b' },
      { start: 1200, end: 1500, text: 'bg', background: true },
      { start: 2000, end: 3000, text: 'c' },
    ]
    expect(activeLineIndex(lines, 1300)).toBe(1)
    expect(activeLineIndex(lines, 2500)).toBe(3)
  })

  it('cleans search noise but never to nothing', () => {
    expect(cleanQuery('Song (Official Video) [4K]')).toBe('Song')
    expect(cleanQuery('(Official Video)')).toBe('(Official Video)')
  })

  it('keeps only the primary artist for scrobbles', () => {
    expect(primaryArtist('Daft Punk, Pharrell Williams')).toBe('Daft Punk')
    expect(primaryArtist('Calvin Harris feat. Rihanna')).toBe('Calvin Harris')
    expect(primaryArtist('Simon & Garfunkel')).toBe('Simon')
    expect(primaryArtist('Maxwell')).toBe('Maxwell')
  })

  it('parses and formats durations', () => {
    expect(durationMillis('3:45')).toBe(225000)
    expect(durationMillis('1:02:03')).toBe(3723000)
    expect(durationMillis('abc')).toBe(0)
    expect(formatTime(225000)).toBe('3:45')
    expect(formatTime(3723000)).toBe('1:02:03')
  })
})

describe('baseTitle', () => {
  it('drops version tags and suffixes for the looser lookup', () => {
    expect(baseTitle('Yeh Awarapan (Rain Version)')).toBe('Yeh Awarapan')
    expect(baseTitle('Tujhe Kitna Chahne Lage (From "Kabir Singh")')).toBe('Tujhe Kitna Chahne Lage')
    expect(baseTitle('Song Name - Slowed + Reverb')).toBe('Song Name')
    expect(baseTitle('Anti-Hero')).toBe('Anti-Hero')
    expect(baseTitle('(Intro)')).toBe('(Intro)')
  })
})
