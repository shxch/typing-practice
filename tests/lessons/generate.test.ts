import { describe, expect, it } from 'vitest'
import { WOF_SENTENCES, WOF_WORDS, WOF_NAMES } from '../../src/content/wof'
import { UNITS, computeProgress, type Progress } from '../../src/lessons/curriculum'
import { baseOf, drillSyllables, generateLesson } from '../../src/lessons/generate'
import { seeded } from '../helpers/rng'

const S = { targetWpm: 25, targetAccuracy: 0.95, minSamples: 15 }
const progressAt = (units: number, focus?: string | null): Progress => {
  const p = computeProgress([], { ...S, manualUnits: units })
  return focus === undefined ? p : { ...p, focus }
}
const words = (lesson: string) => lesson.split(' ')

const ALL_CHARS = new Set(UNITS.flatMap((u) => u.chars))

describe('generateLesson — every unit, many focus keys and seeds', () => {
  const cases: { units: number; focus: string | null; count: number; seed: number }[] = []
  for (let units = 1; units <= UNITS.length; units++) {
    const unlocked = UNITS.slice(0, units).flatMap((u) => u.chars)
    const focuses = [null, unlocked[unlocked.length - 1], unlocked[0], unlocked[Math.floor(unlocked.length / 2)]]
    for (const focus of focuses) for (const count of [5, 20, 80]) for (let seed = 1; seed <= 4; seed++) cases.push({ units, focus, count, seed })
  }

  it.each([['all', cases.length]])('%s cases (%i) produce a well-formed lesson', () => {
    for (const { units, focus, count, seed } of cases) {
      const p = progressAt(units, focus)
      const lesson = generateLesson(p, count, seeded(seed * 7919 + units))
      const where = `units=${units} focus=${focus} count=${count} seed=${seed}: "${lesson}"`

      expect(lesson.length, where).toBeGreaterThan(0)
      expect(lesson, where).not.toMatch(/^ | $|  /)
      // One assertion per lesson, not per character: this loop runs over 100,000 characters.
      const locked = [...lesson].filter((ch) => ch !== ' ' && !p.unlocked.has(ch))
      expect(locked, `${where} uses locked keys`).toEqual([])

      const bases = words(lesson).map(baseOf).filter(Boolean)
      expect(new Set(bases).size, `${where} repeats a word`).toBe(bases.length)

      // Never more than asked for; and not wildly fewer once the vocabulary is big enough.
      expect(words(lesson).length, where).toBeLessThanOrEqual(count + 2)
      if (units >= 3) expect(words(lesson).length, where).toBeGreaterThanOrEqual(Math.min(count, 20) * 0.75)
    }
  })

  it('the very first unit can still fill a 20-word lesson', () => {
    for (let seed = 1; seed <= 20; seed++) {
      expect(words(generateLesson(progressAt(1), 20, seeded(seed))).length).toBeGreaterThanOrEqual(15)
    }
  })

  it('a lowercase focus key appears in a large share of words', () => {
    for (const [units, focus] of [[1, 'j'], [5, UNITS[4].chars[0]], [12, UNITS[11].chars[0]], [19, 'z']] as const) {
      let withFocus = 0
      let total = 0
      for (let seed = 1; seed <= 10; seed++) {
        const w = words(generateLesson(progressAt(units, focus), 20, seeded(seed)))
        total += w.length
        withFocus += w.filter((x) => x.includes(focus)).length
      }
      expect(withFocus / total, `focus ${focus}`).toBeGreaterThanOrEqual(0.3)
    }
  })

  describe('the next-weakest keys', () => {
    const count = (lessons: string[], ch: string) => lessons.join(' ').split(ch).length - 1
    const lessons = (p: Progress) => Array.from({ length: 20 }, (_, i) => generateLesson(p, 20, seeded(i + 1)))
    const base = progressAt(1, 'd')

    it('get words of their own, so even a rare letter is practiced every round', () => {
      const one = lessons({ ...base, weak: ['d'] })
      const three = lessons({ ...base, weak: ['d', 'k', 'j'] })
      // j is in two real words at this point: alone it turns up about once a round.
      expect(count(three, 'j')).toBeGreaterThanOrEqual(count(one, 'j') * 2)
      expect(count(three, 'k')).toBeGreaterThan(count(one, 'k'))
      for (const lesson of three) {
        expect(lesson).toContain('j')
        expect(lesson).toContain('k')
      }
      // The focus key still gets the most.
      for (const ch of 'kj') expect(count(three, 'd')).toBeGreaterThan(count(three, ch))
    })

    it('only two of them, and only lowercase letters', () => {
      const p = { ...base, weak: ['d', 'k', 'j', 'f'] }
      expect(lessons(p)).toEqual(lessons({ ...p, weak: ['d', 'k', 'j'] }))
      expect(lessons({ ...base, weak: ['d', 'K', '?'] })).toEqual(lessons({ ...base, weak: ['d'] }))
    })
  })

  it('a capital focus key appears in capitals-stage lessons', () => {
    const units = UNITS.findIndex((u) => u.chars.includes('M')) + 1
    let hits = 0
    for (let seed = 1; seed <= 10; seed++) hits += generateLesson(progressAt(units, 'M'), 20, seeded(seed)).split('M').length - 1
    expect(hits).toBeGreaterThanOrEqual(20)
  })

  it('stage A lessons are lowercase only; stage B ones contain capitals', () => {
    const lastA = UNITS.findLastIndex((u) => u.stage === 'A') + 1
    expect(generateLesson(progressAt(lastA), 30, seeded(1))).toMatch(/^[a-z ]+$/)
    expect(generateLesson(progressAt(lastA + 1), 30, seeded(1))).toMatch(/[A-Z]/)
  })

  it('punctuation-stage sentences start with a capital and end with sentence punctuation', () => {
    for (let units = UNITS.findIndex((u) => u.stage === 'C') + 1; units <= UNITS.length; units++) {
      for (let seed = 1; seed <= 5; seed++) {
        const lesson = generateLesson(progressAt(units), 25, seeded(seed))
        expect(lesson, lesson).toMatch(/^["(]?[A-Z]/)
        expect(lesson, lesson).toMatch(/[.?!]["')]?$/)
      }
    }
  })

  it('a punctuation focus key is practiced', () => {
    for (const focus of [',', "'", '?', '!', '"', ':', ';', '-', '(']) {
      const units = UNITS.findIndex((u) => u.chars.includes(focus)) + 1
      let hits = 0
      for (let seed = 1; seed <= 5; seed++) hits += generateLesson(progressAt(units, focus), 25, seeded(seed)).split(focus).length - 1
      expect(hits, focus).toBeGreaterThanOrEqual(5)
    }
  })

  it('mixes Wings of Fire and general words', () => {
    const wof = new Set([...WOF_WORDS, ...WOF_NAMES.map((n) => n.toLowerCase())])
    let fromWof = 0
    let total = 0
    for (let seed = 1; seed <= 20; seed++) {
      for (const w of words(generateLesson(progressAt(19, null), 20, seeded(seed)))) {
        total++
        if (wof.has(baseOf(w))) fromWof++
      }
    }
    expect(fromWof / total).toBeGreaterThan(0.3)
    expect(fromWof / total).toBeLessThan(0.7)
  })
})

describe('drillSyllables', () => {
  it('only uses unlocked letters and always contains the focus', () => {
    const unlocked = new Set(UNITS[0].chars)
    for (const focus of UNITS[0].chars) {
      const out = drillSyllables(focus, unlocked)
      expect(out.length).toBeGreaterThan(0)
      for (const s of out) {
        expect(s).toContain(focus)
        for (const c of s) expect(unlocked.has(c)).toBe(true)
      }
    }
  })
})

describe('content', () => {
  it('story sentences only use curriculum characters and never repeat a word', () => {
    for (const s of WOF_SENTENCES) {
      for (const c of s) if (c !== ' ') expect(ALL_CHARS.has(c), `${s}: ${c}`).toBe(true)
      const b = s.split(' ').map(baseOf).filter(Boolean)
      expect(new Set(b).size, s).toBe(b.length)
      expect(s).toMatch(/^["(]?[A-Z]/)
    }
  })

  it('baseOf ignores case and punctuation', () => {
    expect(baseOf('"Clay,')).toBe('clay')
    expect(baseOf("don't")).toBe('dont')
  })
})
