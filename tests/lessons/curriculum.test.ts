import { describe, expect, it } from 'vitest'
import { wpmToMs } from '../../src/engine/typing'
import {
  SHIFTED,
  SHIFT_SLACK,
  UNITS,
  computeProgress,
  hasSlipped,
  meetsTarget,
  targetMs,
  unitChars,
  type SessionLike,
  type UnlockSettings,
} from '../../src/lessons/curriculum'
import { statsFor } from '../helpers/session'

const S: UnlockSettings = { targetWpm: 25, targetAccuracy: 0.95, minSamples: 15, manualUnits: null }
const FAST = 300 // ms per hit, faster than 480 (25 WPM)
const SLOW = 900

/** One round where all keys of the first `units` units were typed at `ms`. */
const round = (startedAt: number, units: number, ms: number, extra: Partial<SessionLike> = {}): SessionLike => ({
  startedAt,
  keyStats: statsFor(unitChars(units), ms),
  units,
  ...extra,
})

describe('UNITS', () => {
  const all = UNITS.flatMap((u) => u.chars)
  it('has every lowercase and capital letter exactly once, lowercase first', () => {
    const lower = all.filter((c) => /[a-z]/.test(c))
    const upper = all.filter((c) => /[A-Z]/.test(c))
    expect(new Set(lower).size).toBe(26)
    expect(lower.length).toBe(26)
    expect(new Set(upper).size).toBe(26)
    expect(upper.length).toBe(26)
    const lastLower = UNITS.map((u) => u.stage).lastIndexOf('A')
    const firstUpper = UNITS.findIndex((u) => u.stage === 'B')
    expect(lastLower).toBeLessThan(firstUpper)
  })

  it('has no duplicate characters and stages in order A, B, C', () => {
    expect(new Set(all).size).toBe(all.length)
    const stages = UNITS.map((u) => u.stage).join('')
    expect(stages).toMatch(/^A+B+C+$/)
  })

  it('starts with the home row', () => {
    expect(UNITS[0].chars).toEqual(expect.arrayContaining(['f', 'j', 'd', 'k']))
  })

  it('marks every shifted character that appears in the curriculum', () => {
    for (const c of all) {
      const needsShift = /[A-Z]/.test(c) || '!?":()'.includes(c)
      expect(SHIFTED.has(c)).toBe(needsShift)
    }
  })
})

describe('targets', () => {
  it('gives shifted keys extra time', () => {
    expect(targetMs('a', S)).toBe(wpmToMs(25))
    expect(targetMs('A', S)).toBeCloseTo(wpmToMs(25) * SHIFT_SLACK)
  })

  it('needs enough samples, speed and accuracy', () => {
    const ok = { samples: 15, ms: 400, acc: 0.96 }
    expect(meetsTarget('a', ok, S)).toBe(true)
    expect(meetsTarget('a', { ...ok, samples: 14 }, S)).toBe(false)
    expect(meetsTarget('a', { ...ok, ms: 500 }, S)).toBe(false)
    expect(meetsTarget('A', { ...ok, ms: 500 }, S)).toBe(true)
    expect(meetsTarget('a', { ...ok, acc: 0.9 }, S)).toBe(false)
    expect(meetsTarget('a', undefined, S)).toBe(false)
    expect(meetsTarget('a', { samples: 20, ms: null, acc: 1 }, S)).toBe(false)
  })
})

describe('computeProgress', () => {
  it('starts with the first unit and no data', () => {
    const p = computeProgress([], S)
    expect(p.unlockedUnits).toBe(1)
    expect(p.stage).toBe('A')
    expect([...p.unlocked].sort()).toEqual([...UNITS[0].chars].sort())
    expect(p.focus).not.toBeNull()
    expect(p.weak.length).toBe(UNITS[0].chars.length)
    expect(p.done).toBe(false)
  })

  it('unlocks the next unit only when every unlocked key is on target', () => {
    expect(computeProgress([round(1, 1, FAST)], S).unlockedUnits).toBe(2)
    expect(computeProgress([round(1, 1, SLOW)], S).unlockedUnits).toBe(1)
    // one slow key holds everything back
    const s = round(1, 1, FAST)
    s.keyStats.f = { n: 20, miss: 0, t: 20, ms: SLOW * 20 }
    const p = computeProgress([s], S)
    expect(p.unlockedUnits).toBe(1)
    expect(p.focus).toBe('f')
    expect(p.weak).toEqual(['f'])
  })

  describe('keys pass one by one and keep it', () => {
    const [first, ...others] = UNITS[0].chars
    /** A round where only `chars` were typed, at `ms` per hit with `miss` of 20 tries wrong. */
    const only = (startedAt: number, chars: string[], ms: number, miss = 0): SessionLike => ({
      startedAt,
      keyStats: statsFor(chars, ms, 20 - miss, miss),
      units: 1,
    })

    it('unlocks when every key has passed, even in different rounds', () => {
      const list = [only(1, [first], FAST), only(2, others, FAST)]
      expect(computeProgress(list.slice(0, 1), S).unlockedUnits).toBe(1)
      expect(computeProgress(list, S).unlockedUnits).toBe(2)
    })

    it('a passed key that dips a little is still passed', () => {
      // 93% is under the 95% target but well above the slip line (90%).
      const p = computeProgress([only(1, [first], FAST), only(2, [first], FAST, 2)], S)
      expect(p.keys[first].acc).toBeLessThan(S.targetAccuracy)
      expect(meetsTarget(first, p.keys[first], S)).toBe(false)
      expect(p.passed.has(first)).toBe(true)
      expect(p.weak).not.toContain(first)
      expect(computeProgress([only(1, [first], FAST), only(2, [first], FAST, 2), only(3, others, FAST)], S).unlockedUnits).toBe(2)
    })

    it('a passed key that clearly slips has to pass again', () => {
      const sloppy = computeProgress([only(1, [first], FAST), only(2, [first], FAST, 10), only(3, others, FAST)], S)
      expect(hasSlipped(first, sloppy.keys[first], S)).toBe(true)
      expect(sloppy.passed.has(first)).toBe(false)
      expect(sloppy.unlockedUnits).toBe(1)
      expect(sloppy.weak).toEqual([first])

      const slow = computeProgress([only(1, [first], FAST), only(2, [first], SLOW), only(3, [first], SLOW)], S)
      expect(slow.passed.has(first)).toBe(false)
    })

    it('a key that never reached the target has not passed', () => {
      const p = computeProgress([only(1, [first], FAST, 2), only(2, others, FAST)], S)
      expect(p.passed.has(first)).toBe(false)
      expect(p.unlockedUnits).toBe(1)
    })

    it('newly unlocked keys start out not passed', () => {
      const p = computeProgress([only(1, UNITS[0].chars, FAST)], S)
      expect(p.unlockedUnits).toBe(2)
      expect(p.weak).toEqual(UNITS[1].chars)
    })
  })

  it('does not unlock when accuracy is too low', () => {
    const s: SessionLike = { startedAt: 1, keyStats: statsFor(unitChars(1), FAST, 20, 5), units: 1 }
    expect(computeProgress([s], S).unlockedUnits).toBe(1)
  })

  it('does not unlock before minSamples clean hits', () => {
    const s: SessionLike = { startedAt: 1, keyStats: statsFor(unitChars(1), FAST, 10), units: 1 }
    expect(computeProgress([s], S).unlockedUnits).toBe(1)
    expect(computeProgress([s, { ...s, startedAt: 2 }], S).unlockedUnits).toBe(2)
  })

  it('gives the same result whatever order sessions arrive in', () => {
    const list = [round(3, 2, FAST), round(1, 1, FAST), round(2, 1, SLOW), round(4, 3, FAST)]
    const a = computeProgress(list, S)
    const b = computeProgress([...list].reverse(), S)
    expect(a.unlockedUnits).toBe(b.unlockedUnits)
    expect(a.keys).toEqual(b.keys)
  })

  it('never takes keys away when the target is raised later', () => {
    const list = [round(1, 1, FAST), round(2, 2, FAST)]
    const before = computeProgress(list, S).unlockedUnits
    expect(computeProgress(list, { ...S, targetWpm: 100 }).unlockedUnits).toBeGreaterThanOrEqual(2)
    expect(before).toBeGreaterThanOrEqual(2)
  })

  it('reaches the end and reports done when everything is fast', () => {
    const p = computeProgress([round(1, UNITS.length, FAST)], S)
    expect(p.unlockedUnits).toBe(UNITS.length)
    expect(p.stage).toBe('C')
    expect(p.weak).toEqual([])
    expect(p.done).toBe(true)
    expect(p.focus).not.toBeNull() // keeps polishing the slowest key
  })

  it('clamps nonsense unit counts from old or corrupted sessions', () => {
    for (const units of [0, -5, 999, NaN]) {
      const p = computeProgress([{ startedAt: 1, keyStats: {}, units }], S)
      expect(p.unlockedUnits).toBeGreaterThanOrEqual(1)
      expect(p.unlockedUnits).toBeLessThanOrEqual(UNITS.length)
      expect(Number.isInteger(p.unlockedUnits)).toBe(true)
    }
  })

  it('weak keys without enough practice come before merely slow ones', () => {
    const s = round(1, 2, FAST)
    s.keyStats.f = { n: 20, miss: 0, t: 20, ms: SLOW * 20 }
    delete s.keyStats[UNITS[1].chars[0]]
    const p = computeProgress([s], { ...S, manualUnits: 2 })
    expect(p.weak[0]).toBe(UNITS[1].chars[0])
    expect(p.weak).toContain('f')
  })

  describe('manual jump', () => {
    it('starts from the chosen unit and keeps unlocking from there', () => {
      const p = computeProgress([], { ...S, manualUnits: 10 })
      expect(p.unlockedUnits).toBe(10)
      expect(p.earnedUnits).toBe(1)
      const q = computeProgress([round(1, 10, FAST)], { ...S, manualUnits: 10 })
      expect(q.unlockedUnits).toBe(11)
    })

    it('a manual jump below what practice earned changes nothing', () => {
      const list = [round(1, 1, FAST), round(2, 2, FAST)]
      expect(computeProgress(list, { ...S, manualUnits: 1 }).unlockedUnits).toBe(computeProgress(list, S).unlockedUnits)
    })

    it('rounds played during a jump do not count as earned by practice', () => {
      // Jumped to 30, played a (slow) round there, then undid the jump.
      const played = round(1, 30, SLOW, { earnedUnits: 1 })
      const jumped = computeProgress([played], { ...S, manualUnits: 30 })
      expect(jumped.unlockedUnits).toBe(30)
      expect(jumped.earnedUnits).toBe(1)
      expect(computeProgress([played], S).unlockedUnits).toBe(1)
    })

    it('sessions from before earnedUnits existed keep their recorded units', () => {
      expect(computeProgress([{ startedAt: 1, keyStats: {}, units: 5 }], S).unlockedUnits).toBe(5)
    })
  })
})
