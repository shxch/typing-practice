import { describe, expect, it } from 'vitest'
import { ACCURACY_RULES_FROM, LEVEL_STARS, levelOf, roundsOn, starsByRound, starsFor, streak, totalStars } from '../../src/rewards/rewards'
import { dayAt, makeSession } from '../helpers/session'

const R = { targetWpm: 25, targetAccuracy: 0.95 }

describe('stars', () => {
  const stars = (wpm: number, accuracy: number, r = R) => starsFor({ wpm, accuracy, startedAt: ACCURACY_RULES_FROM }, r)
  const oldStars = (wpm: number, accuracy: number) => starsFor({ wpm, accuracy, startedAt: ACCURACY_RULES_FROM - 1 }, R)

  // Target net speed: 25 × 95% = 23.75; cuts at 30% / 50% / 75% / 100% = 7.1, 11.9, 17.8, 23.75
  it('up to four stars depend only on net speed, against the target', () => {
    expect(stars(7, 0.96)).toBe(1)
    expect(stars(8, 0.96)).toBe(2)
    expect(stars(13, 0.96)).toBe(3)
    expect(stars(19, 0.96)).toBe(4)
    expect(stars(25, 0.96)).toBe(5)
  })

  it('mistakes lower the score', () => {
    expect(stars(25, 0.95)).toBe(5) // 23.75
    expect(stars(25, 0.8)).toBe(4) // 20
    expect(stars(25, 0.4)).toBe(2) // 10
  })

  it('the fifth star needs the target accuracy, however fast the round', () => {
    expect(stars(40, 0.94)).toBe(4)
    expect(stars(40, 0.95)).toBe(5)
    expect(stars(60, 0.8)).toBe(4)
  })

  it('a hidden sixth star needs 98%+ accuracy at the target speed, not more speed', () => {
    expect(stars(25, 0.98)).toBe(6) // 24.5 ≥ 23.75
    expect(stars(25, 1)).toBe(6)
    expect(stars(50, 0.97)).toBe(5) // fast, but not clean enough
    expect(stars(20, 1)).toBe(4) // clean, but under the target speed
  })

  it('rounds from before the accuracy rules keep the stars they were given', () => {
    expect(oldStars(40, 0.8)).toBe(5) // 32 net: five stars despite the mistakes
    expect(oldStars(36, 1)).toBe(6) // 36 ≥ 35.6, 150% of the target
    expect(oldStars(36, 0.97)).toBe(5)
    expect(oldStars(25, 1)).toBe(5) // the rainbow star needed speed back then
  })

  it('a higher target makes the same round worth fewer stars', () => {
    expect(stars(24, 1, { targetWpm: 40, targetAccuracy: 0.95 })).toBe(3)
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
  /** `rounds` rounds played on a day. */
  const on = (d: number, rounds: number, h = 12) =>
    Array.from({ length: rounds }, (_, i) => makeSession({ startedAt: dayAt(2026, 9, d, h, i) }))

  it('roundsOn counts a day', () => {
    expect(roundsOn([...on(1, 5), ...on(1, 7, 20), ...on(2, 30)], '2026-09-01')).toBe(12)
  })

  it('counts consecutive goal days ending today', () => {
    const list = [...on(1, 15), ...on(2, 15), ...on(3, 10), ...on(3, 6, 20)]
    expect(streak(list, 15, dayAt(2026, 9, 3, 22))).toBe(3)
  })

  it("today's unmet goal doesn't break the streak yet", () => {
    expect(streak([...on(1, 15), ...on(2, 15), ...on(3, 1)], 15, dayAt(2026, 9, 3, 8))).toBe(2)
  })

  it('a missed day breaks it', () => {
    expect(streak([...on(1, 15), ...on(3, 15)], 15, dayAt(2026, 9, 3, 22))).toBe(1)
    expect(streak(on(1, 15), 15, dayAt(2026, 9, 3, 22))).toBe(0)
  })

  it('survives daylight-saving changes and month/year boundaries', () => {
    const days = [
      [2026, 3, 7], [2026, 3, 8], [2026, 3, 9], // US spring forward
      [2026, 10, 31], [2026, 11, 1], [2026, 11, 2], // US fall back
      [2026, 12, 31], [2027, 1, 1],
    ]
    const s = (y: number, m: number, d: number) => makeSession({ startedAt: dayAt(y, m, d, 0, 30) })
    expect(streak(days.slice(0, 3).map(([y, m, d]) => s(y, m, d)), 1, dayAt(2026, 3, 9, 23))).toBe(3)
    expect(streak(days.slice(3, 6).map(([y, m, d]) => s(y, m, d)), 1, dayAt(2026, 11, 2, 23))).toBe(3)
    expect(streak(days.slice(6).map(([y, m, d]) => s(y, m, d)), 1, dayAt(2027, 1, 1, 23))).toBe(2)
  })
})
