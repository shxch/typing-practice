import { describe, expect, it } from 'vitest'
import type { KeyStats } from '../engine/typing'
import { UNITS, computeProgress, type UnlockSettings } from './curriculum'

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
    const letters = UNITS.filter((u) => u.stage === 'A').flatMap((u) => u.chars)
    const good = session(1, [...letters, ...'ASDFJKLE'], fast)
    const qSlipped = session(2, ['q'], slow)
    const p = computeProgress([good, qSlipped], { ...settings, manualUnits: 20 })
    expect(p.stage).toBe('B')
    expect(p.focus).toBe('q')
  })

  it('keeps a focus key even when everything is on target', () => {
    const fast = 60000 / (25 * 5)
    const p = computeProgress([session(1, UNITS[0].chars, fast)], { ...settings, manualUnits: 1 })
    expect(p.weak).toEqual([])
    expect(p.focus).not.toBeNull()
  })

  it('honours the manual override', () => {
    const p = computeProgress([], { ...settings, manualUnits: 20 })
    expect(p.stage).toBe('B')
    expect(p.unlocked.has('A')).toBe(true)
    expect(p.earnedUnits).toBe(1)
  })
})
