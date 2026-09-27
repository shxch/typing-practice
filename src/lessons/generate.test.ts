import { describe, expect, it } from 'vitest'
import { UNITS, computeProgress, type UnlockSettings } from './curriculum'
import { WOF_NAMES, WOF_WORDS } from '../content/wof'
import { baseOf, generateLesson } from './generate'

/** Deterministic PRNG (mulberry32). */
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const base: UnlockSettings = { targetWpm: 20, targetAccuracy: 0.9, minSamples: 10, manualUnits: null }

describe('generateLesson', () => {
  it('only uses unlocked keys at every point of the curriculum', () => {
    for (let units = 1; units <= UNITS.length; units++) {
      const p = computeProgress([], { ...base, manualUnits: units })
      for (let seed = 1; seed <= 5; seed++) {
        const text = generateLesson(p, 25, rng(seed * 100 + units))
        const bad = [...text].filter((c) => c !== ' ' && !p.unlocked.has(c))
        expect(bad, `units=${units} text=${text}`).toEqual([])
        expect(text.split(' ').length).toBeGreaterThanOrEqual(20)
        expect(text).not.toMatch(/^ | $|  /)
      }
    }
  })

  it('never repeats a word within a lesson', () => {
    for (let units = 1; units <= UNITS.length; units++) {
      const p = computeProgress([], { ...base, manualUnits: units })
      for (let seed = 1; seed <= 8; seed++) {
        const words = generateLesson(p, 30, rng(seed * 31 + units)).split(' ').map(baseOf).filter(Boolean)
        const dupes = words.filter((w, i) => words.indexOf(w) !== i)
        expect(dupes, `units=${units} seed=${seed}`).toEqual([])
      }
    }
  })

  it('is about half Wings of Fire words once enough keys are unlocked', () => {
    const wof = new Set([...WOF_WORDS, ...WOF_NAMES.map((n) => n.toLowerCase())])
    for (const units of [19, 23, 33]) {
      const p = computeProgress([], { ...base, manualUnits: units })
      const words = generateLesson(p, 40, rng(units)).split(' ').map(baseOf).filter(Boolean)
      const share = words.filter((w) => wof.has(w)).length / words.length
      expect(share, `units=${units}`).toBeGreaterThanOrEqual(0.4)
      expect(share, `units=${units}`).toBeLessThanOrEqual(0.65)
    }
  })

  it('uses character names in lowercase before capitals are unlocked', () => {
    const p = computeProgress([], { ...base, manualUnits: 19 }) // all lowercase letters
    const names = new Set(WOF_NAMES.map((n) => n.toLowerCase()))
    const seen = new Set<string>()
    for (let seed = 1; seed <= 20; seed++) {
      for (const w of generateLesson(p, 30, rng(seed)).split(' ')) if (names.has(w)) seen.add(w)
    }
    expect(seen.size).toBeGreaterThan(5)
  })

  it('leans on the focus key', () => {
    const p = computeProgress([], { ...base, manualUnits: 2 }) // focus on the new key "i"
    expect(p.focus).toBe('i')
    const words = generateLesson(p, 40, rng(7)).split(' ')
    expect(words.filter((w) => w.includes('i')).length).toBeGreaterThanOrEqual(12)
  })

  it('gives rare keys enough practice even with few real words', () => {
    const p = computeProgress([], { ...base, manualUnits: 1 })
    const hits = (text: string) => [...text].filter((c) => c === 'j').length
    const withFocus = { ...p, focus: 'j', weak: ['j'] }
    expect(hits(generateLesson(withFocus, 20, rng(3)))).toBeGreaterThanOrEqual(10)
  })

  it('leans on a weak key from an earlier stage', () => {
    const b = computeProgress([], { ...base, manualUnits: 20 })
    const qText = generateLesson({ ...b, focus: 'q' }, 30, rng(4))
    expect([...qText].filter((c) => c === 'q').length).toBeGreaterThanOrEqual(8)
    const c = computeProgress([], { ...base, manualUnits: 26 })
    const tText = generateLesson({ ...c, focus: 'T' }, 30, rng(5))
    expect([...tText].filter((ch) => ch === 'T').length).toBeGreaterThanOrEqual(6)
  })

  it('practices capitals in stage B and punctuation in stage C', () => {
    const b = computeProgress([], { ...base, manualUnits: 20 })
    expect(generateLesson(b, 30, rng(1))).toMatch(/[A-Z]/)
    const c = computeProgress([], { ...base, manualUnits: 26 }) // . , '
    expect(c.focus).toBe("'")
    const text = generateLesson(c, 40, rng(2))
    expect(text).toMatch(/\./)
    expect(text).toMatch(/'/) // focus is the newest unit, the apostrophe
  })
})
