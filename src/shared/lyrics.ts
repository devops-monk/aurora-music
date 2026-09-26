import type { LyricLine } from './models'

/**
 * Lyric parsers, ported from BitChord's `LrcLib.kt` and `TtmlLyrics.kt`.
 *
 * Pure string work with no DOM, so they run the same in the main process, the
 * renderer and the tests.
 */

const STAMP = /\[(\d{1,3}):(\d{2})[.:](\d{2,3})]/
const WORD_STAMP = /<(\d{1,3}):(\d{2})[.:](\d{2,3})>/g
/** A gap shorter than this is not worth an instrumental "…" line. */
const MIN_GAP_MS = 4000

const msOf = (m: string, s: string, f: string) =>
  Number(m) * 60_000 + Number(s) * 1000 + (f.length === 2 ? Number(f) * 10 : f.length === 3 ? Number(f) : 0)

/** Standard and "enhanced" (word-stamped `<mm:ss.xx>`) LRC. */
export function parseLrc(lrc: string): LyricLine[] {
  const parsed: LyricLine[] = []
  for (const raw of lrc.split(/\r?\n/)) {
    const match = STAMP.exec(raw)
    if (!match) continue
    const start = msOf(match[1], match[2], match[3])
    let body = raw.slice(match.index + match[0].length)
    const opposite = body.startsWith('<R>')
    if (opposite) body = body.slice(3)
    const words = parseWordRuns(body)
    const text = body.replace(WORD_STAMP, '').trim()
    parsed.push({ start, end: start, text, words: words.length ? words : undefined, oppositeTurn: opposite || undefined })
  }
  parsed.sort((a, b) => a.start - b.start)
  return finishLines(parsed.filter((l, i) => l.text !== '' || i === parsed.length - 1 || parsed[i + 1].start - l.start >= MIN_GAP_MS))
}

function parseWordRuns(body: string) {
  const marks = [...body.matchAll(WORD_STAMP)]
  if (!marks.length) return []
  const runs = marks.map((mark, i) => {
    const until = marks[i + 1]?.index ?? body.length
    return { start: msOf(mark[1], mark[2], mark[3]), text: body.slice(mark.index! + mark[0].length, until) }
  })
  return runs
    .map((run, i) => ({ start: run.start, end: Math.max(runs[i + 1]?.start ?? run.start, run.start), text: run.text.trim() }))
    .filter((w) => w.text !== '')
}

/** Fills in each line's end from the next line's start, and marks a leading instrumental gap. */
function finishLines(lines: LyricLine[]): LyricLine[] {
  const out = lines.map((l, i) => {
    const nextStart = lines[i + 1]?.start
    const wordsEnd = l.words?.length ? l.words[l.words.length - 1].end : 0
    return { ...l, end: Math.max(nextStart ?? l.start + 5000, wordsEnd) }
  })
  const first = out[0]
  if (first && first.text !== '' && first.start >= MIN_GAP_MS) out.unshift({ start: 0, end: first.start, text: '' })
  return out
}

/** TTML clock value: `12.3s`, `1:02.5`, `00:01:02.500`, `1500ms`. */
export function ttmlTime(value: string | undefined | null): number | null {
  const raw = value?.trim()
  if (!raw) return null
  if (raw.endsWith('ms')) return Number.isFinite(Number(raw.slice(0, -2))) ? Math.round(Number(raw.slice(0, -2))) : null
  const parts = raw.replace(/s$/, '').split(':').map(Number)
  if (parts.some((p) => !Number.isFinite(p))) return null
  const seconds = parts.length === 1 ? parts[0] : parts.length === 2 ? parts[0] * 60 + parts[1] : parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : NaN
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : null
}

const decodeEntities = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')

function attr(tag: string, name: string): string | undefined {
  const local = name.includes(':') ? name.split(':')[1] : name
  const re = new RegExp(`(?:^|\\s)(?:[\\w-]+:)?${local}\\s*=\\s*("([^"]*)"|'([^']*)')`)
  const m = re.exec(tag)
  return m ? (m[2] ?? m[3]) : undefined
}

interface Piece {
  text: string
  start?: number
  end?: number
  bg: boolean
}

/** Apple Music-style TTML (the format BetterLyrics serves), with word timing and background vocals. */
export function parseTtml(ttml: string): LyricLine[] {
  const agents = new Map<string, string>()
  for (const m of ttml.matchAll(/<(?:ttm:)?agent\b([^>]*)>/g)) {
    const id = attr(m[1], 'xml:id')
    const type = attr(m[1], 'type')
    if (id && type) agents.set(id, type)
  }
  const body = ttml.slice(Math.max(0, ttml.search(/<body\b/)))
  const lines: LyricLine[] = []
  const agentOrder: string[] = []
  for (const p of body.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g)) {
    const pAttrs = p[1]
    const pieces: Piece[] = []
    // A tiny tokenizer: a stack of open spans, each knowing whether it is timed and background.
    const stack: { timed: boolean; bg: boolean; start?: number; end?: number }[] = []
    const tokens = p[2].split(/(<[^>]+>)/)
    for (const tok of tokens) {
      if (!tok) continue
      if (tok.startsWith('</')) {
        stack.pop()
      } else if (tok.startsWith('<')) {
        if (tok.endsWith('/>')) continue
        const role = attr(tok, 'ttm:role')
        const parent = stack[stack.length - 1]
        const begin = ttmlTime(attr(tok, 'begin'))
        const end = ttmlTime(attr(tok, 'end'))
        stack.push({
          timed: begin !== null && end !== null,
          bg: (parent?.bg ?? false) || role === 'x-bg',
          start: begin ?? undefined,
          end: end ?? undefined,
        })
      } else {
        const top = stack[stack.length - 1]
        const text = decodeEntities(tok)
        if (top?.timed) pieces.push({ text, start: top.start, end: top.end, bg: top.bg })
        else pieces.push({ text, bg: top?.bg ?? false })
      }
    }
    const words = mergeWords(pieces.filter((x) => !x.bg))
    const backing = mergeWords(pieces.filter((x) => x.bg))
    const agent = attr(pAttrs, 'ttm:agent')
    if (agent && !agentOrder.includes(agent)) agentOrder.push(agent)
    // Second distinct *person* agent sings from the right, like Apple Music duets.
    const opposite = !!agent && agentOrder.indexOf(agent) % 2 === 1 && agents.get(agent) !== 'group'
    const pBegin = ttmlTime(attr(pAttrs, 'begin'))
    const pEnd = ttmlTime(attr(pAttrs, 'end'))
    if (words.length) {
      lines.push({
        start: Math.min(pBegin ?? words[0].start, words[0].start),
        end: Math.max(pEnd ?? 0, words[words.length - 1].end),
        text: words.map((w) => w.text).join(' '),
        words,
        oppositeTurn: opposite || undefined,
      })
    } else {
      const text = decodeEntities(p[2].replace(/<[^>]+>/g, '')).trim()
      if (text && pBegin !== null) lines.push({ start: pBegin, end: pEnd ?? pBegin, text, oppositeTurn: opposite || undefined })
    }
    if (backing.length) {
      lines.push({
        start: backing[0].start,
        end: backing[backing.length - 1].end,
        text: backing.map((w) => w.text).join(' '),
        words: backing,
        background: true,
        oppositeTurn: opposite || undefined,
      })
    }
  }
  lines.sort((a, b) => a.start - b.start)
  // Instrumental gaps between sung lines become an empty "…" line.
  const withGaps: LyricLine[] = []
  lines.forEach((line, i) => {
    const prevEnd = i === 0 ? 0 : Math.max(...lines.slice(0, i).map((l) => l.end))
    if (!line.background && line.start - prevEnd >= MIN_GAP_MS * 2) withGaps.push({ start: prevEnd, end: line.start, text: '' })
    withGaps.push(line)
  })
  return withGaps
}

/** Timed fragments to words: syllables with no whitespace between them join into one word. */
function mergeWords(pieces: Piece[]) {
  const words: { start: number; end: number; text: string }[] = []
  let current = ''
  let start = 0
  let end = 0
  let timed = false
  const flush = () => {
    const text = current.trim()
    current = ''
    if (text && timed) words.push({ start, end, text })
    timed = false
  }
  for (const piece of pieces) {
    if (piece.start === undefined) {
      if (piece.text.trim() === '') flush()
      else if (timed) current += piece.text
      continue
    }
    if (piece.text.trim() === '') continue
    if (/^\s/.test(piece.text)) flush()
    if (current === '') start = piece.start
    current += piece.text.trim()
    end = piece.end ?? piece.start
    timed = true
    if (/\s$/.test(piece.text)) flush()
  }
  flush()
  return words
}

/** Plain, unsynced lyrics: one line per non-empty line of text. */
export function plainLines(text: string): LyricLine[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((t) => ({ start: 0, end: 0, text: t }))
}

/** Title/artist cleanup before searching lyrics providers (`LrcLib.clean`). */
export function cleanQuery(value: string): string {
  const cleaned = value
    .replace(/\((?:from|feat\.?|official|lyrical|video|audio|remix)[^)]*\)|\[[^\]]*]|\b(?:official (?:video|audio|music video)|lyrical|full song|4k video)\b/gi, ' ')
    .split(' | ')[0]
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || value
}

/**
 * A title with every bracketed part and " - …" suffix removed: "Yeh Awarapan
 * (Rain Version)" becomes "Yeh Awarapan". Only for a second, looser lookup,
 * since what was removed may name a different recording.
 */
export function baseTitle(value: string): string {
  const base = value
    .replace(/\([^)]*\)|\[[^\]]*]/g, ' ')
    .split(/\s[-–—|]\s/)[0]
    .replace(/\s+/g, ' ')
    .trim()
  return base || value
}

/** The index of the line playing at [ms], or -1 before the first. */
export function activeLineIndex(lines: LyricLine[], ms: number): number {
  let found = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].background) continue
    if (lines[i].start <= ms) found = i
    else break
  }
  return found
}
