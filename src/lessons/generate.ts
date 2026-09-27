// Builds lesson text out of real words, using only unlocked keys and leaning on the focus key.

import { CONTRACTIONS, HYPHENATED, PROPER_NOUNS, WORDS } from '../content/words'
import type { Progress } from './curriculum'

export type Rng = () => number

const pick = <T,>(arr: T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)]

const onlyUses = (word: string, allowed: Set<string>) => [...word].every((c) => allowed.has(c))

const capitalize = (w: string) => w[0].toUpperCase() + w.slice(1)

/** Pick `count` words, roughly `focusShare` of them containing the focus key, avoiding back-to-back repeats. */
function pickWords(pool: string[], focus: string | null, count: number, rng: Rng, focusShare = 0.5): string[] {
  const focused = focus ? pool.filter((w) => w.includes(focus)) : []
  return pickFrom(pool, focused, count, rng, focusShare)
}

function pickFrom(pool: string[], focused: string[], count: number, rng: Rng, focusShare: number): string[] {
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const source = focused.length > 0 && rng() < focusShare ? focused : pool
    let w = pick(source, rng)
    for (let tries = 0; tries < 5 && out.length > 0 && w === out[out.length - 1]; tries++) {
      w = pick(source, rng)
    }
    out.push(w)
  }
  return out
}

function lowercasePool(unlocked: Set<string>): string[] {
  const pool = WORDS.filter((w) => onlyUses(w, unlocked))
  // Very early on, fall back to short letter groups so there is always something to type.
  if (pool.length >= 8) return pool
  const letters = [...unlocked].filter((c) => /[a-z]/.test(c))
  const extra = Array.from({ length: 30 }, (_, i) =>
    Array.from({ length: 2 + (i % 3) }, (_, j) => letters[(i * 7 + j * 3) % letters.length]).join(''),
  )
  return [...pool, ...extra]
}

const VOWELS = 'aeiou'

/**
 * Short syllables around a key (e.g. "ja", "jed", "aj") for keys that few real words
 * can exercise with the letters unlocked so far, like j early on.
 */
export function drillSyllables(focus: string, unlocked: Set<string>): string[] {
  const letters = [...unlocked].filter((c) => /[a-z]/.test(c))
  const vowels = letters.filter((c) => VOWELS.includes(c) && c !== focus)
  const consonants = letters.filter((c) => !VOWELS.includes(c) && c !== focus)
  const out = new Set<string>()
  if (VOWELS.includes(focus)) {
    for (const c of consonants) out.add(c + focus).add(focus + c).add(c + focus + c)
  } else {
    for (const v of vowels) {
      out.add(focus + v).add(v + focus)
      for (const c of consonants.slice(0, 4)) out.add(focus + v + c)
    }
  }
  return [...out]
}

/** Below this many real words for the focus key, mix in drill syllables. */
const MIN_FOCUS_WORDS = 12

function stageA(p: Progress, count: number, rng: Rng): string {
  const pool = lowercasePool(p.unlocked)
  const focus = p.focus
  if (!focus) return pickWords(pool, null, count, rng).join(' ')
  let focused = pool.filter((w) => w.includes(focus))
  let share = 0.5
  if (focused.length < MIN_FOCUS_WORDS) {
    focused = [...focused, ...focused, ...drillSyllables(focus, p.unlocked)]
    share = 0.65
  }
  return pickFrom(pool, focused, count, rng, share).join(' ')
}

function stageB(p: Progress, count: number, rng: Rng): string {
  const caps = [...p.unlocked].filter((c) => /[A-Z]/.test(c))
  const names = PROPER_NOUNS.filter((n) => caps.includes(n[0]) && onlyUses(n, p.unlocked))
  const words = pickWords(lowercasePool(p.unlocked), null, count, rng)
  const focusCap = p.focus && /[A-Z]/.test(p.focus) ? p.focus : null
  const focusWords = focusCap ? WORDS.filter((w) => w[0] === focusCap.toLowerCase()) : []
  const focusNames = focusCap ? names.filter((n) => n[0] === focusCap) : []

  return words
    .map((w, i) => {
      const r = rng()
      if (focusCap && r < 0.35) {
        return focusNames.length > 0 && rng() < 0.4 ? pick(focusNames, rng) : capitalize(pick(focusWords, rng))
      }
      if (r < 0.55 && names.length > 0) return pick(names, rng)
      if (r < 0.7 && caps.includes(w[0].toUpperCase())) return capitalize(w)
      return i === 0 && caps.includes(w[0].toUpperCase()) ? capitalize(w) : w
    })
    .join(' ')
}

/** Ways a word can carry a punctuation mark. Sentence-ending marks are handled separately. */
const DECORATE: Record<string, (w: string, rng: Rng) => string> = {
  ',': (w) => `${w},`,
  "'": (_w, rng) => pick(CONTRACTIONS, rng),
  '"': (w) => `"${w}"`,
  ':': (w) => `${w}:`,
  ';': (w) => `${w};`,
  '-': (_w, rng) => pick(HYPHENATED, rng),
  '(': (w) => `(${w})`,
  ')': (w) => `(${w})`,
}
const ENDINGS = ['.', '?', '!']

function stageC(p: Progress, count: number, rng: Rng): string {
  const unlocked = p.unlocked
  const words = pickWords(lowercasePool(unlocked), null, count, rng)
  const marks = Object.keys(DECORATE).filter((m) => unlocked.has(m))
  const endings = ENDINGS.filter((m) => unlocked.has(m))
  const focus = p.focus
  const focusIsEnding = focus !== null && ENDINGS.includes(focus)

  const out: string[] = []
  let sentenceLen = 0
  let target = 4 + Math.floor(rng() * 4)
  for (let i = 0; i < words.length; i++) {
    let w = sentenceLen === 0 ? capitalize(words[i]) : words[i]
    const last = i === words.length - 1
    if (sentenceLen + 1 >= target || last) {
      const end = focusIsEnding && rng() < 0.6 ? focus! : pick(endings, rng)
      out.push(w + end)
      sentenceLen = 0
      target = focusIsEnding ? 2 + Math.floor(rng() * 3) : 4 + Math.floor(rng() * 4)
      continue
    }
    const wantFocus = focus !== null && DECORATE[focus] && rng() < 0.4
    if (wantFocus) {
      w = DECORATE[focus!](w, rng)
    } else if (marks.length > 0 && rng() < 0.15) {
      w = DECORATE[pick(marks, rng)](w, rng)
    }
    // Keep the first word of a sentence capitalized even after decoration.
    if (sentenceLen === 0 && /^[a-z]/.test(w)) w = capitalize(w)
    out.push(w)
    sentenceLen++
  }
  return out.join(' ')
}

export function generateLesson(p: Progress, wordCount: number, rng: Rng = Math.random): string {
  switch (p.stage) {
    case 'A':
      return stageA(p, wordCount, rng)
    case 'B':
      return stageB(p, wordCount, rng)
    case 'C':
      return stageC(p, wordCount, rng)
  }
}
