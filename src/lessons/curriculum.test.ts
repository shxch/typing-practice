import { describe, expect, it } from 'vitest'
import type { KeyStats } from '../engine/typing'
import { SHIFT_SLACK, UNITS, computeProgress, meetsTarget, targetMs, type UnlockSettings } from './curriculum'

const settings: UnlockSettings = { targetWpm: 20, targetAccuracy: 0.9, minSamples: 10, manualUnits: null }

/** A session where every given key was hit 20 times at `ms` per key. */
const session = (startedAt: number, chars: string[], ms: number, miss = 0) => {
  const keyStats: KeyStats = {}
  for (const c of chars) keyStats[c] = { n: 20, miss, t: 20, ms: ms * 20 }
  return { startedAt, keyStats }
}

describe('curriculum', () => {
  it('has 26 lowercase letters, 26 capitals and the punctuation', () => {
    const chars = UNITS.flatMap((u) => u.chars)
    expect(new Set(chars).size).toBe(chars.length)
    expect(chars.filter((c) => /[a-z]/.test(c))).toHaveLength(26)
    expect(chars.filter((c) => /[A-Z]/.test(c))).toHaveLength(26)
    expect(chars).toEqual(expect.arrayContaining(['.', ',', "'", '?', '!', '"', ':', ';', '-', '(', ')']))
  })

  it('has 19 lowercase units, 4 capital groups and 10 punctuation units', () => {
    expect(UNITS.filter((u) => u.stage === 'A')).toHaveLength(19)
    expect(UNITS.filter((u) => u.stage === 'B')).toHaveLength(4)
    expect(UNITS.filter((u) => u.stage === 'C')).toHaveLength(10)
  })

  it('starts with the first unit in stage A', () => {
    const p = computeProgress([], settings)
    expect(p.unlockedUnits).toBe(1)
    expect(p.stage).toBe('A')
    expect([...p.unlocked].sort().join('')).toBe('adefjkls')
  })

  it('unlocks the next key once all unlocked keys are fast and accurate', () => {
    const fast = 60000 / (25 * 5) // 25 wpm
    const p = computeProgress([session(1, UNITS[0].chars, fast)], settings)
    expect(p.unlockedUnits).toBe(2)
    expect(p.unlocked.has('i')).toBe(true)
    expect(p.focus).toBe('i') // new key has no samples yet
  })

  it('does not unlock when too slow or inaccurate', () => {
    const slow = 60000 / (10 * 5)
    expect(computeProgress([session(1, UNITS[0].chars, slow)], settings).unlockedUnits).toBe(1)
    const fast = 60000 / (25 * 5)
    expect(computeProgress([session(1, UNITS[0].chars, fast, 10)], settings).unlockedUnits).toBe(1)
  })

  it('is independent of session order in the input', () => {
    const fast = 60000 / (25 * 5)
    const a = session(1, UNITS[0].chars, fast)
    const b = session(2, [...UNITS[0].chars, 'i'], fast)
    expect(computeProgress([b, a], settings).unlockedUnits).toBe(computeProgress([a, b], settings).unlockedUnits)
  })

  it('focuses on a weak key from an earlier stage', () => {
    const fast = 60000 / (25 * 5)
    const slow = 60000 / (10 * 5)
    const everything = UNITS.flatMap((u) => u.chars)
    const p = computeProgress([session(1, everything, fast), session(2, ['q'], slow)], settings)
    expect(p.unlockedUnits).toBe(UNITS.length)
    expect(p.focus).toBe('q')
  })

  it('keeps a focus key even when everything is on target', () => {
    const fast = 60000 / (25 * 5)
    const p = computeProgress([session(1, UNITS.flatMap((u) => u.chars), fast)], settings)
    expect(p.weak).toEqual([])
    expect(p.focus).not.toBeNull()
  })

  it('never takes unlocked keys away when the target is raised', () => {
    const fast = 60000 / (25 * 5)
    const played = { ...session(1, UNITS[0].chars, fast), units: 1 }
    const later = { startedAt: 2, keyStats: {}, units: 2 } // a round played with 2 units unlocked
    expect(computeProgress([played, later], settings).unlockedUnits).toBe(2)
    // Much stricter target: the old sessions no longer qualify, but round 2 was played with 2 units.
    expect(computeProgress([played, later], { ...settings, targetWpm: 80 }).unlockedUnits).toBe(2)
  })

  it('a manual jump is a starting point; unlocking carries on from there', () => {
    const fast = 60000 / (25 * 5)
    const p0 = computeProgress([], { ...settings, manualUnits: 5 })
    expect(p0.unlockedUnits).toBe(5)
    expect(p0.earnedUnits).toBe(1)
    const chars = UNITS.slice(0, 5).flatMap((u) => u.chars)
    const p1 = computeProgress([session(1, chars, fast)], { ...settings, manualUnits: 5 })
    expect(p1.unlockedUnits).toBe(6)
    // A jump below what's already earned changes nothing.
    const p2 = computeProgress([session(1, UNITS[0].chars, fast)], { ...settings, manualUnits: 1 })
    expect(p2.unlockedUnits).toBe(2)
  })

  it('a round with one stray hit barely moves a key', () => {
    const fast = 60000 / (25 * 5)
    const oneSlowHit = { startedAt: 2, keyStats: { a: { n: 1, miss: 0, t: 1, ms: 5000 } } }
    const p = computeProgress([session(1, UNITS[0].chars, fast), oneSlowHit], settings)
    expect(p.keys.a.ms!).toBeLessThan(fast * 1.5)
    const manySlow = { startedAt: 2, keyStats: { a: { n: 20, miss: 0, t: 20, ms: 20 * 5000 } } }
    expect(computeProgress([session(1, UNITS[0].chars, fast), manySlow], settings).keys.a.ms!).toBeGreaterThan(fast * 3)
  })

  it('gives keys that need Shift extra time', () => {
    expect(targetMs('A', settings)).toBeCloseTo(targetMs('a', settings) * SHIFT_SLACK)
    expect(targetMs('?', settings)).toBeGreaterThan(targetMs('.', settings))
    const alittleSlow = targetMs('a', settings) * 1.2
    const perf = { samples: 20, ms: alittleSlow, acc: 1 }
    expect(meetsTarget('A', perf, settings)).toBe(true)
    expect(meetsTarget('a', perf, settings)).toBe(false)
  })

  it('can jump straight to the capitals stage', () => {
    const p = computeProgress([], { ...settings, manualUnits: 20 })
    expect(p.stage).toBe('B')
    expect(p.unlocked.has('A')).toBe(true)
    expect(p.earnedUnits).toBe(1)
  })
})
