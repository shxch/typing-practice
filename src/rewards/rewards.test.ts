import { describe, expect, it } from 'vitest'
import type { Session } from '../store/types'
import { levelOf, starsFor, streak } from './rewards'

const rules = { targetWpm: 25, targetAccuracy: 0.95 }

const S = (day: number, minutes: number): Session => ({
  id: `${day}-${minutes}`,
  startedAt: new Date(2026, 8, day, 18).getTime(),
  endedAt: 0,
  device: 'x',
  stage: 'A',
  units: 1,
  chars: 1,
  wpm: 20,
  accuracy: 1,
  durationMs: minutes * 60000,
  keyStats: {},
})

describe('rewards', () => {
  it('awards stars for accuracy first, then speed', () => {
    expect(starsFor({ wpm: 40, accuracy: 0.8 }, rules)).toBe(1)
    expect(starsFor({ wpm: 10, accuracy: 0.96 }, rules)).toBe(2)
    expect(starsFor({ wpm: 26, accuracy: 0.97 }, rules)).toBe(3)
  })

  it('computes levels', () => {
    expect(levelOf(0)).toEqual({ level: 0, current: 0, next: 10 })
    expect(levelOf(26)).toEqual({ level: 2, current: 25, next: 45 })
  })

  it('counts consecutive goal days, not breaking before today is over', () => {
    const now = new Date(2026, 8, 27, 9).getTime()
    const sessions = [S(24, 10), S(25, 6), S(25, 5), S(26, 12)]
    expect(streak(sessions, 10, now)).toBe(3) // 24, 25 (6+5), 26; today not done yet
    expect(streak([...sessions, S(27, 10)], 10, now)).toBe(4)
    expect(streak([S(24, 10), S(26, 10)], 10, now)).toBe(1) // gap on the 25th
    expect(streak([S(25, 10)], 10, now)).toBe(0) // yesterday missed
  })
})
