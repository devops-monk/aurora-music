import type { LyricsTranslation } from '@shared/api'

/**
 * Lyrics translation, after BitChord's `LyricsTranslation.kt`: Google's
 * key-free web endpoint with `sl=auto`, lines batched up to 3,500 characters
 * and kept apart by private-use markers (U+E000 index U+E001), so each answer
 * maps back to exactly the line it came from. A partial or malformed answer is
 * discarded rather than half-applied; the original lyrics stay on screen.
 *
 * The endpoint is not a versioned public API, which is why it lives alone in
 * this file: replacing the provider means replacing one function.
 */

const ENDPOINT = 'https://translate.googleapis.com/translate_a/single'
const MAX_BATCH_CHARS = 3500
const TIMEOUT_MS = 12_000

const marker = (i: number) => `${String(i).padStart(4, '0')}`
const cache = new Map<string, LyricsTranslation>()

/**
 * One request. Returns a map of batch position → translation, read off the
 * markers themselves: Google sometimes merges or drops a marker (repeated
 * lines are the usual cause), and indexing by marker keeps every translation
 * that did come back on the line it belongs to instead of shifting the rest.
 */
async function translateBatch(texts: string[], target: string): Promise<{ parts: Map<number, string>; source: string } | null> {
  const q = texts.map((t, i) => marker(i) + t).join('')
  const body = new URLSearchParams({ client: 'dict-chrome-ex', sl: 'auto', tl: target, dt: 't', q })
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    body,
    headers: { 'User-Agent': 'Aurora Music', Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) return null
  const root = (await res.json()) as unknown[]
  const segments = (root[0] as unknown[][] | null) ?? []
  const joined = segments.map((s) => (typeof s?.[0] === 'string' ? s[0] : '')).join('')
  const parts = new Map<number, string>()
  const re = /\uE000(\d+)\uE001([^\uE000]*)/g
  for (const m of joined.matchAll(re)) {
    const i = Number(m[1])
    const text = m[2].trim()
    if (i < texts.length && text) parts.set(i, text)
  }
  return { parts, source: typeof root[2] === 'string' ? root[2] : '' }
}

/** The base language of a tag, with Google's legacy aliases folded in. */
export function baseLanguage(tag: string): string {
  const base = tag.toLowerCase().split(/[-_]/)[0]
  return ({ iw: 'he', in: 'id', ji: 'yi' } as Record<string, string>)[base] ?? base
}

/**
 * Translates [lines] into [target], keeping their positions: blank
 * (instrumental) lines are never sent and come back blank.
 */
export async function translateLyrics(videoId: string, lines: string[], target: string): Promise<LyricsTranslation> {
  const tl = baseLanguage(target)
  const key = `${videoId}|${tl}|${lines.length}`
  const hit = cache.get(key)
  if (hit) return hit

  const slots = lines.map((text, index) => ({ text: text.trim(), index })).filter((s) => s.text)
  const batches: (typeof slots)[] = []
  let current: typeof slots = []
  let size = 0
  for (const slot of slots) {
    if (current.length && size + slot.text.length + 6 > MAX_BATCH_CHARS) {
      batches.push(current)
      current = []
      size = 0
    }
    current.push(slot)
    size += slot.text.length + 6
  }
  if (current.length) batches.push(current)

  const out: string[] = lines.map(() => '')
  let source = ''
  const missing: typeof slots = []
  // Two requests at a time: long lyrics stay quick without crowding the audio stream.
  for (let i = 0; i < batches.length; i += 2) {
    const group = batches.slice(i, i + 2)
    const answers = await Promise.all(group.map((b) => translateBatch(b.map((s) => s.text), tl)))
    answers.forEach((answer, k) => {
      if (!answer) {
        missing.push(...group[k])
        return
      }
      source ||= answer.source
      group[k].forEach((slot, j) => {
        const text = answer.parts.get(j)
        if (text) out[slot.index] = text
        else missing.push(slot)
      })
    })
  }
  // Lines a batch lost get a second, smaller try; whatever is still missing stays untranslated.
  for (let i = 0; i < missing.length && i < 60; i += 10) {
    const chunk = missing.slice(i, i + 10)
    const answer = await translateBatch(chunk.map((s) => s.text), tl).catch(() => null)
    chunk.forEach((slot, j) => {
      const text = answer?.parts.get(j)
      if (text) out[slot.index] = text
    })
    source ||= answer?.source ?? ''
  }
  if (!out.some(Boolean)) throw new Error('Translation unavailable right now.')
  // A line already in the target language (mixed-language songs) comes back as
  // itself; showing it twice adds nothing, so it stays without a translation.
  const same = (a: string, b: string) => a.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '') === b.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  out.forEach((t, i) => {
    if (t && same(t, lines[i])) out[i] = ''
  })
  const result: LyricsTranslation = {
    lines: out,
    sourceLanguage: baseLanguage(source || 'und'),
    targetLanguage: tl,
    sameLanguage: baseLanguage(source) === tl,
  }
  if (cache.size > 200) cache.clear()
  cache.set(key, result)
  return result
}
