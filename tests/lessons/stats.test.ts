import { describe, expect, it } from 'vitest'
import { byTime, dailyRounds, dayKey, keySpeedSeries, keySummary, lastWithDelta, sessionsOnDay, totals } from '../../src/lessons/stats'
import { dayAt, makeSession } from '../helpers/session'

const k = (n: number, t: number, ms: number, miss = 0) => ({ n, miss, t, ms })

describe('per-key statistics', () => {
  const sorted = byTime([
    makeSession({ startedAt: 3, keyStats: { a: k(10, 10, 3000) } }),
    makeSession({ startedAt: 1, keyStats: { a: k(10, 10, 6000, 2) } }),
    makeSession({ startedAt: 2, keyStats: { b: k(5, 5, 1000) } }),
    makeSession({ startedAt: 4, keyStats: { a: k(3, 0, 0, 1) } }),
  ])

  it('sorts by start time without mutating', () => {
    expect(sorted.map((s) => s.startedAt)).toEqual([1, 2, 3, 4])
  })

  it('speed series is numbered by lesson and skips rounds without timed hits', () => {
    expect(keySpeedSeries(sorted, 'a')).toEqual([
      { lesson: 1, value: 20 },
      { lesson: 3, value: 40 },
    ])
    expect(keySpeedSeries(sorted, 'z')).toEqual([])
  })

  it('skips impossible speeds (0 ms samples from old data)', () => {
    const bad = [makeSession({ keyStats: { a: k(1, 1, 0) } })]
    expect(keySpeedSeries(bad, 'a')).toEqual([])
    expect(keySummary(bad, 'a').best).toBeNull()
  })

  it('summary adds up hits and misses across all rounds', () => {
    const s = keySummary(sorted, 'a')
    expect(s.hits).toBe(23)
    expect(s.misses).toBe(3)
    expect(s.accuracy).toBeCloseTo(23 / 26)
    expect(s.best).toBe(40)
    expect(s.recent).toBe(30)
    expect(keySummary(sorted, 'a', 1).recent).toBe(40)
    expect(keySummary(sorted, 'z')).toEqual({ hits: 0, misses: 0, accuracy: null, best: null, recent: null })
  })
})

describe('totals', () => {
  it('is empty-safe', () => {
    expect(totals([])).toEqual({ timeMs: 0, lessons: 0, topWpm: null, avgWpm: null, topAcc: null, avgAcc: null })
  })

  it('computes top and average', () => {
    const t = totals([makeSession({ wpm: 10, accuracy: 0.9, durationMs: 1000 }), makeSession({ wpm: 30, accuracy: 1, durationMs: 2000 })])
    expect(t).toEqual({ timeMs: 3000, lessons: 2, topWpm: 30, avgWpm: 20, topAcc: 1, avgAcc: 0.95 })
  })
})

describe('days', () => {
  it('dayKey uses the local calendar day', () => {
    expect(dayKey(dayAt(2026, 9, 27, 0, 0))).toBe('2026-09-27')
    expect(dayKey(dayAt(2026, 9, 27, 23, 59))).toBe('2026-09-27')
    expect(dayKey(dayAt(2026, 1, 5))).toBe('2026-01-05')
  })

  it('counts rounds per day', () => {
    const list = [
      makeSession({ startedAt: dayAt(2026, 9, 1, 9), durationMs: 60_000 }),
      makeSession({ startedAt: dayAt(2026, 9, 1, 21), durationMs: 30_000 }),
      makeSession({ startedAt: dayAt(2026, 9, 2, 9), durationMs: 10_000 }),
    ]
    expect(Object.fromEntries(dailyRounds(list))).toEqual({ '2026-09-01': 2, '2026-09-02': 1 })
    expect(sessionsOnDay(list, '2026-09-01')).toHaveLength(2)
  })
})

describe('lastWithDelta', () => {
  it('compares the last round to the average of the ones before', () => {
    const list = [10, 20, 30].map((wpm, i) => makeSession({ wpm, startedAt: i }))
    expect(lastWithDelta(list, (s) => s.wpm)).toEqual({ value: 30, delta: 15 })
    expect(lastWithDelta(list.slice(0, 1), (s) => s.wpm)).toEqual({ value: 10, delta: null })
    expect(lastWithDelta([], (s) => s.wpm)).toBeNull()
    expect(lastWithDelta(list, (s) => s.wpm, 1)).toEqual({ value: 30, delta: 10 })
  })
})
