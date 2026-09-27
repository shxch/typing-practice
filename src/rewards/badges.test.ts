import { describe, expect, it } from 'vitest'
import type { Session } from '../store/types'
import { BADGES, computeBadges, newBadges } from './badges'

const rules = { targetWpm: 25, targetAccuracy: 0.95, dailyGoalMinutes: 15 }

let n = 0
const S = (day: number, o: Partial<Session> = {}): Session => {
  const startedAt = new Date(2026, 8, day, 18, n++).getTime()
  return {
    id: String(n),
    startedAt,
    endedAt: startedAt + 60000,
    device: 'mac',
    stage: 'A',
    units: 1,
    chars: 100,
    wpm: 15,
    accuracy: 0.9,
    durationMs: 60000,
    keyStats: {},
    ...o,
  }
}

const earned = (states: ReturnType<typeof computeBadges>) =>
  states.filter((s) => s.earnedAt !== null).map((s) => s.badge.id).sort()

describe('badges', () => {
  it('have unique ids', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length)
  })

  it('nothing before practicing', () => {
    expect(earned(computeBadges([], rules))).toEqual([])
  })

  it('first round, speed, accuracy and stars', () => {
    const got = earned(computeBadges([S(1, { wpm: 31, accuracy: 1 })], rules))
    expect(got).toEqual(
      expect.arrayContaining(['rounds-1', 'speed-10', 'speed-20', 'speed-30', 'accuracy-1', 'stars-1']),
    )
    expect(got).not.toContain('speed-40')
  })

  it('daily goal and streaks', () => {
    const days = [1, 2, 3].map((d) => S(d, { durationMs: 15 * 60000 }))
    const got = earned(computeBadges(days, rules))
    expect(got).toEqual(expect.arrayContaining(['streak-1', 'streak-3']))
    // A gap resets the streak.
    const gap = earned(computeBadges([S(1, { durationMs: 15 * 60000 }), S(3, { durationMs: 15 * 60000 }), S(4, { durationMs: 15 * 60000 })], rules))
    expect(gap).not.toContain('streak-3')
  })

  it('accuracy runs reset on a sloppy round', () => {
    const run = [...Array(4)].map(() => S(5, { accuracy: 0.97 }))
    expect(earned(computeBadges([...run, S(5, { accuracy: 0.8 }), S(5, { accuracy: 0.97 })], rules))).not.toContain('accuracy-5')
    expect(earned(computeBadges([...run, S(5, { accuracy: 0.97 })], rules))).toContain('accuracy-5')
  })

  it('unlock badges count the current unlocks too, and two devices', () => {
    const s = [S(6, { units: 10 }), S(6, { device: 'tv' })]
    expect(earned(computeBadges(s, rules))).toContain('keys-2')
    expect(earned(computeBadges(s, rules))).not.toContain('keys-19')
    expect(earned(computeBadges(s, rules, 19))).toContain('keys-19')
  })

  it('reports what a new round earned', () => {
    const before = computeBadges([S(7)], rules)
    const after = computeBadges([S(7), S(7, { accuracy: 1 })], rules)
    expect(newBadges(before, after).map((b) => b.id)).toEqual(['accuracy-1'])
  })

  it('shows progress toward unearned badges', () => {
    const p = computeBadges([S(8, { wpm: 45 })], rules).find((b) => b.badge.id === 'speed-60')!
    expect(p.progress).toBeCloseTo(0.75)
  })
})
