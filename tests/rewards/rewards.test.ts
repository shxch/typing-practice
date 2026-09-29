import { describe, expect, it } from 'vitest'
import { LEVEL_STARS, levelOf, minutesOn, starsByRound, starsFor, streak, totalStars } from '../../src/rewards/rewards'
import { dayAt, makeSession } from '../helpers/session'

const R = { targetWpm: 25, targetAccuracy: 0.95 }

describe('stars', () => {
  // Target net speed: 25 × 95% = 23.75; cuts at 30% / 50% / 75% / 100% = 7.1, 11.9, 17.8, 23.75
  it('depends only on speed and accuracy, against the target', () => {
    expect(starsFor({ wpm: 7, accuracy: 1 }, R)).toBe(1)
    expect(starsFor({ wpm: 8, accuracy: 1 }, R)).toBe(2)
    expect(starsFor({ wpm: 12, accuracy: 1 }, R)).toBe(3)
    expect(starsFor({ wpm: 18, accuracy: 1 }, R)).toBe(4)
    expect(starsFor({ wpm: 24, accuracy: 1 }, R)).toBe(5)
  })

  it('mistakes lower the score', () => {
    expect(starsFor({ wpm: 25, accuracy: 0.95 }, R)).toBe(5) // 23.75
    expect(starsFor({ wpm: 25, accuracy: 0.8 }, R)).toBe(4) // 20
    expect(starsFor({ wpm: 25, accuracy: 0.4 }, R)).toBe(2) // 10
  })

  it('a higher target makes the same round worth fewer stars', () => {
    expect(starsFor({ wpm: 24, accuracy: 1 }, { targetWpm: 40, targetAccuracy: 0.95 })).toBe(3)
  })

  it('rounds are rated one by one, whatever else was played', () => {
    const list = [30, 10, 11].map((wpm, i) => makeSession({ id: `r${i}`, wpm, accuracy: 1, startedAt: i }))
    const stars = starsByRound(list, R)
    expect([...stars.values()]).toEqual([5, 2, 2])
  })

  it('totals over sessions', () => {
    expect(totalStars([makeSession({ wpm: 30, accuracy: 1 }), makeSession({ wpm: 1, accuracy: 0.5 })], R)).toBe(6)
    expect(totalStars([], R)).toBe(0)
  })
})

describe('levels', () => {
  it('thresholds are increasing and start at 0', () => {
    expect(LEVEL_STARS[0]).toBe(0)
    for (let i = 1; i < LEVEL_STARS.length; i++) expect(LEVEL_STARS[i]).toBeGreaterThan(LEVEL_STARS[i - 1])
  })

  it('levels up exactly at each threshold', () => {
    LEVEL_STARS.forEach((stars, level) => {
      expect(levelOf(stars).level).toBe(level)
      if (stars > 0) expect(levelOf(stars - 1).level).toBe(level - 1)
    })
  })

  it('has no next level at the top', () => {
    const top = LEVEL_STARS[LEVEL_STARS.length - 1]
    expect(levelOf(top * 10)).toEqual({ level: LEVEL_STARS.length - 1, current: top, next: null })
    expect(levelOf(0)).toEqual({ level: 0, current: 0, next: LEVEL_STARS[1] })
  })
})

describe('daily goal and streak', () => {
  const on = (d: number, minutes: number, h = 12) => makeSession({ startedAt: dayAt(2026, 9, d, h), durationMs: minutes * 60_000 })

  it('minutesOn adds up a day', () => {
    expect(minutesOn([on(1, 5), on(1, 7, 20), on(2, 30)], '2026-09-01')).toBe(12)
  })

  it('counts consecutive goal days ending today', () => {
    const list = [on(1, 15), on(2, 15), on(3, 10), on(3, 6)]
    expect(streak(list, 15, dayAt(2026, 9, 3, 22))).toBe(3)
  })

  it("today's unmet goal doesn't break the streak yet", () => {
    expect(streak([on(1, 15), on(2, 15), on(3, 1)], 15, dayAt(2026, 9, 3, 8))).toBe(2)
  })

  it('a missed day breaks it', () => {
    expect(streak([on(1, 15), on(3, 15)], 15, dayAt(2026, 9, 3, 22))).toBe(1)
    expect(streak([on(1, 15)], 15, dayAt(2026, 9, 3, 22))).toBe(0)
  })

  it('survives daylight-saving changes and month/year boundaries', () => {
    const days = [
      [2026, 3, 7], [2026, 3, 8], [2026, 3, 9], // US spring forward
      [2026, 10, 31], [2026, 11, 1], [2026, 11, 2], // US fall back
      [2026, 12, 31], [2027, 1, 1],
    ]
    const s = (y: number, m: number, d: number) => makeSession({ startedAt: dayAt(y, m, d, 0, 30), durationMs: 20 * 60_000 })
    expect(streak(days.slice(0, 3).map(([y, m, d]) => s(y, m, d)), 15, dayAt(2026, 3, 9, 23))).toBe(3)
    expect(streak(days.slice(3, 6).map(([y, m, d]) => s(y, m, d)), 15, dayAt(2026, 11, 2, 23))).toBe(3)
    expect(streak(days.slice(6).map(([y, m, d]) => s(y, m, d)), 15, dayAt(2027, 1, 1, 23))).toBe(2)
  })
})
