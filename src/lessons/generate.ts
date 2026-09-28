// Builds lesson text from real words — half Wings of Fire vocabulary, half general words —
// using only unlocked keys, leaning on the focus key, and never repeating a word in a lesson.

import { CONTRACTIONS, HYPHENATED, PROPER_NOUNS, WORDS } from '../content/words'
import { WOF_HYPHENATED, WOF_NAMES, WOF_SENTENCES, WOF_WORDS } from '../content/wof'
import type { Progress } from './curriculum'

export type Rng = () => number

/** Share of each lesson taken from Wings of Fire words; the rest are general words. */
const WOF_SHARE = 0.5
/** Below this many real words for the focus key, mix in drill syllables. */
const MIN_FOCUS_WORDS = 12

interface Cand {
  word: string
  /** From the Wings of Fire lists (vs. general words). */
  wof: boolean
}

const onlyUses = (text: string, allowed: Set<string>) => [...text].every((c) => c === ' ' || allowed.has(c))
const capitalize = (w: string) => w[0].toUpperCase() + w.slice(1)
const isLower = (c: string | null): c is string => c !== null && /^[a-z]$/.test(c)
const isUpper = (c: string | null): c is string => c !== null && /^[A-Z]$/.test(c)

/** The word itself, ignoring case and punctuation: "Clay," and "clay" are the same word. */
export const baseOf = (token: string) => token.toLowerCase().replace(/[^a-z]/g, '')

/**
 * Picks words without repeats. Everything taken from one Picker is unique (case-insensitive),
 * which is what keeps a lesson free of duplicates.
 */
class Picker {
  private used = new Set<string>()
  constructor(readonly rng: Rng) {}

  isUsed(token: string) {
    return this.used.has(baseOf(token))
  }

  mark(token: string) {
    this.used.add(baseOf(token))
  }

  /** Up to `n` unused words, uniformly at random, without replacement. */
  private sample(cands: Cand[], n: number): string[] {
    if (n <= 0) return []
    const fresh: string[] = []
    const seen = new Set<string>()
    for (const c of cands) {
      const b = baseOf(c.word)
      if (!b || this.used.has(b) || seen.has(b)) continue
      seen.add(b)
      fresh.push(c.word)
    }
    const out = this.shuffle(fresh).slice(0, n)
    out.forEach((w) => this.mark(w))
    return out
  }

  /**
   * `n` unused words: half Wings of Fire, half general. If one side runs short (e.g. early on,
   * when few letters are unlocked) the other side fills in.
   */
  take(cands: Cand[], n: number): string[] {
    const wof = cands.filter((c) => c.wof)
    const general = cands.filter((c) => !c.wof)
    const a = this.sample(wof, Math.round(n * WOF_SHARE))
    const b = this.sample(general, n - a.length)
    const c = this.sample(wof, n - a.length - b.length)
    return this.shuffle([...a, ...b, ...c])
  }

  shuffle<T>(arr: T[]): T[] {
    const a = arr.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  pickOne<T>(arr: T[]): T | undefined {
    return arr[Math.floor(this.rng() * arr.length)]
  }
}

/**
 * Lowercase candidates made only of unlocked keys, tagged Wings of Fire or general (lessons take half of each).
 * Characters' names join in lowercase ("clay", "qibli") only while
 * their capitals can't be typed yet — after that they appear properly capitalized instead.
 */
function lowercaseCands(unlocked: Set<string>): Cand[] {
  const lowerNames = WOF_NAMES.filter((n) => !onlyUses(n, unlocked)).map((n) => n.toLowerCase())
  const wof = Array.from(new Set([...WOF_WORDS, ...lowerNames])).filter((w) => onlyUses(w, unlocked))
  const wofSet = new Set(wof)
  const general = WORDS.filter((w) => !wofSet.has(w) && onlyUses(w, unlocked))
  return [...wof.map((word) => ({ word, wof: true })), ...general.map((word) => ({ word, wof: false }))]
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

/** `count` unique lowercase words; about half contain the focus letter if it's lowercase. */
function lowercaseWords(p: Progress, count: number, pk: Picker): string[] {
  if (count <= 0) return []
  const cands = lowercaseCands(p.unlocked)
  const focus = p.focus
  if (!isLower(focus)) return pk.take(cands, count)

  let focused = cands.filter((c) => c.word.includes(focus))
  let share = 0.5
  if (focused.length < MIN_FOCUS_WORDS) {
    focused = [...focused, ...drillSyllables(focus, p.unlocked).map((word) => ({ word, wof: false }))]
    share = 0.65
  }
  const withFocus = pk.take(focused, Math.round(count * share))
  const rest = pk.take(cands, count - withFocus.length)
  return pk.shuffle([...withFocus, ...rest])
}

/** Capitalized words and names, for the capitals stage and beyond. */
function capitalCands(unlocked: Set<string>, first: (c: string) => boolean): Cand[] {
  const names = [...WOF_NAMES.map((word) => ({ word, wof: true })), ...PROPER_NOUNS.map((word) => ({ word, wof: false }))]
  const words = lowercaseCands(unlocked).map((c) => ({ word: capitalize(c.word), wof: c.wof }))
  return [...names, ...words].filter((c) => first(c.word[0]) && onlyUses(c.word, unlocked))
}

/** Words for stages B and C: lowercase words plus capitalized words and names. */
function mixedWords(p: Progress, count: number, pk: Picker): string[] {
  if (count <= 0) return []
  const caps = new Set([...p.unlocked].filter((c) => /[A-Z]/.test(c)))
  const focusCap = isUpper(p.focus) ? p.focus : null
  const withFocusCap = focusCap ? pk.take(capitalCands(p.unlocked, (c) => c === focusCap), Math.round(count * 0.35)) : []
  const otherCaps = pk.take(
    capitalCands(p.unlocked, (c) => caps.has(c)),
    Math.round(count * (focusCap ? 0.2 : 0.35)),
  )
  const lower = lowercaseWords(p, count - withFocusCap.length - otherCaps.length, pk)
  return pk.shuffle([...withFocusCap, ...otherCaps, ...lower])
}

/** Ways a word can carry a punctuation mark. Sentence-ending marks are handled separately. */
type Decorate = (w: string, pk: Picker) => string | null
const replaceWith =
  (list: string[]): Decorate =>
  (_w, pk) => {
    const pick = pk.pickOne(list.filter((x) => !pk.isUsed(x)))
    if (pick) pk.mark(pick)
    return pick ?? null
  }
const contraction = replaceWith(CONTRACTIONS)
const DECORATE: Record<string, Decorate> = {
  ',': (w) => `${w},`,
  // Half contractions ("don't"), half possessives ("Clay's") so sentences still read naturally.
  "'": (w, pk) => {
    // "Clay's" reads as the word "clays", so it must not collide with a word already in the lesson.
    if (pk.rng() < 0.5 && /^[A-Za-z]+[^s]$/.test(w) && !pk.isUsed(`${w}s`)) {
      pk.mark(`${w}s`)
      return `${w}'s`
    }
    return contraction(w, pk)
  },
  '"': (w) => `"${w}"`,
  ':': (w) => `${w}:`,
  ';': (w) => `${w};`,
  '-': replaceWith([...WOF_HYPHENATED, ...HYPHENATED]),
  '(': (w) => `(${w})`,
  ')': (w) => `(${w})`,
}
const ENDINGS = ['.', '?', '!']

/**
 * Up to `max` Wings of Fire sentences that fit the unlocked keys and share no word with each
 * other (or with anything already in the lesson), `budget` words in total at most.
 * Sentences with the focus key come first.
 */
function storySentences(p: Progress, max: number, budget: number, pk: Picker): string[] {
  const fits = pk.shuffle(WOF_SENTENCES.filter((s) => onlyUses(s, p.unlocked)))
  const focus = p.focus
  const ordered = focus ? [...fits.filter((s) => s.includes(focus)), ...fits.filter((s) => !s.includes(focus))] : fits
  const out: string[] = []
  for (const s of ordered) {
    if (out.length >= max) break
    const words = s.split(' ').map(baseOf).filter(Boolean)
    if (s.split(' ').length > budget) continue
    if (new Set(words).size !== words.length || words.some((w) => pk.isUsed(w))) continue
    budget -= s.split(' ').length
    words.forEach((w) => pk.mark(w))
    out.push(s)
  }
  return out
}

function sentences(p: Progress, count: number, pk: Picker): string {
  const rng = pk.rng
  const unlocked = p.unlocked
  // A couple of story sentences, then generated sentences for the rest of the words.
  const story = storySentences(p, count >= 16 ? 2 : 1, count, pk)
  const storyWords = story.reduce((n, s) => n + s.split(' ').length, 0)
  const words = mixedWords(p, Math.max(0, count - storyWords), pk)
  const marks = Object.keys(DECORATE).filter((m) => unlocked.has(m))
  const endings = ENDINGS.filter((m) => unlocked.has(m))
  const focus = p.focus
  const focusIsEnding = focus !== null && ENDINGS.includes(focus)
  const focusDecor = focus !== null ? DECORATE[focus] : undefined

  const generated: string[] = []
  let current: string[] = []
  let target = 4 + Math.floor(rng() * 4)
  for (let i = 0; i < words.length; i++) {
    const start = current.length === 0
    let w = start ? capitalize(words[i]) : words[i]
    const last = i === words.length - 1
    if (!start && (current.length + 1 >= target || last)) {
      const end = focusIsEnding && rng() < 0.6 ? focus! : pk.pickOne(endings)!
      generated.push([...current, w + end].join(' '))
      current = []
      target = focusIsEnding ? 2 + Math.floor(rng() * 3) : 4 + Math.floor(rng() * 4)
      continue
    }
    let decorated: string | null = null
    if (focusDecor && rng() < 0.4) decorated = focusDecor(w, pk)
    else if (marks.length > 0 && rng() < 0.15) decorated = DECORATE[pk.pickOne(marks)!](w, pk)
    if (decorated) w = decorated
    // Keep the first word of a sentence capitalized even after decoration.
    if (start && /^[a-z]/.test(w)) w = capitalize(w)
    current.push(w)
    // A lone last word still needs to end its sentence.
    if (last) generated.push(current.join(' ') + (pk.pickOne(endings) ?? ''))
  }
  return pk.shuffle([...story, ...generated]).join(' ')
}

export function generateLesson(p: Progress, wordCount: number, rng: Rng = Math.random): string {
  const pk = new Picker(rng)
  switch (p.stage) {
    case 'A':
      return lowercaseWords(p, wordCount, pk).join(' ')
    case 'B':
      return mixedWords(p, wordCount, pk).join(' ')
    case 'C':
      return sentences(p, wordCount, pk)
  }
}
