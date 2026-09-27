import { describe, expect, it } from 'vitest'
import type { Session } from '../store/types'
import { dailyTime, dayKey, keySpeedSeries, keySummary, lastWithDelta, smooth, totals } from './stats'

const S = (startedAt: number, wpm: number, accuracy: number, keyStats: Session['keyStats'] = {}): Session => ({
  id: String(startedAt),
  startedAt,
  endedAt: startedAt + 60000,
  device: 'x',
  stage: 'A',
  units: 1,
  chars: 100,
  wpm,
  accuracy,
  durationMs: 60000,
  keyStats,
})

// 600 ms per hit = 20 wpm, 300 ms = 40 wpm
const k = (t: number, ms: number, miss = 0) => ({ n: t, miss, t, ms: ms * t })

describe('stats', () => {
  const day1 = new Date(2026, 8, 26, 10).getTime()
  const day2 = new Date(2026, 8, 27, 10).getTime()
  const sessions = [S(day1, 20, 0.9, { a: k(10, 600) }), S(day2, 30, 1, { b: k(5, 300) }), S(day2 + 1000, 40, 0.95, { a: k(10, 300, 2) })]

  it('builds a per-key speed series with lesson numbers', () => {
    expect(keySpeedSeries(sessions, 'a')).toEqual([
      { lesson: 1, value: 20 },
      { lesson: 3, value: 40 },
    ])
  })

  it('smooths', () => {
    const s = smooth(
      [
        { lesson: 1, value: 10 },
        { lesson: 2, value: 20 },
      ],
      0.5,
    )
    expect(s[1].value).toBeCloseTo(15)
  })

  it('summarizes a key', () => {
    const sum = keySummary(sessions, 'a')
    expect(sum.hits).toBe(20)
    expect(sum.misses).toBe(2)
    expect(sum.best).toBeCloseTo(40)
    expect(sum.recent).toBeCloseTo(30)
    expect(keySummary(sessions, 'z').best).toBeNull()
  })

  it('totals and daily time', () => {
    const t = totals(sessions)
    expect(t.lessons).toBe(3)
    expect(t.topWpm).toBe(40)
    expect(t.avgWpm).toBeCloseTo(30)
    expect(dailyTime(sessions).get(dayKey(day2))).toBe(120000)
  })

  it('compares the last lesson against the ones before it', () => {
    expect(lastWithDelta(sessions, (s) => s.wpm)).toEqual({ value: 40, delta: 15 })
    expect(lastWithDelta([], (s) => s.wpm)).toBeNull()
  })
})
