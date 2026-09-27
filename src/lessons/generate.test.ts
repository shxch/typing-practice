import { describe, expect, it } from 'vitest'
import { UNITS, computeProgress, type UnlockSettings } from './curriculum'
import { generateLesson } from './generate'

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
