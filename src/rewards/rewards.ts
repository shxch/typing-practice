// Daily motivation: stars per round, levels, the daily goal and the streak.
// All derived from the session log, so every device agrees.

import { dayKey } from '../lessons/stats'
import type { Session } from '../store/types'

export interface StarRules {
  targetWpm: number
  targetAccuracy: number
}

export type Stars = 1 | 2 | 3 | 4 | 5

/** Speed (as a share of the target) needed for 3, 4 and 5 stars. */
export const STAR_SPEEDS = [0.8, 1, 1.2] as const

/**
 * 1 star for finishing, 2 for a careful round (accuracy on target); on top of that,
 * 3 at 80% of the target speed, 4 at the target speed and 5 at 120% of it.
 * Accuracy comes first on purpose: it's the habit that matters most for a beginner.
 */
export function starsFor(s: Pick<Session, 'wpm' | 'accuracy'>, r: StarRules): Stars {
  if (s.accuracy < r.targetAccuracy) return 1
  const fast = STAR_SPEEDS.filter((f) => s.wpm >= f * r.targetWpm).length
  return (2 + fast) as Stars
}

export function totalStars(sessions: Session[], r: StarRules): number {
  return sessions.reduce((a, s) => a + starsFor(s, r), 0)
}

/**
 * Stars needed to reach each level. Gaps grow slowly so there's always a next level in sight.
 * Sized for up to 5 stars a round.
 */
export const LEVEL_STARS = [0, 15, 40, 75, 115, 165, 230, 315, 415, 530, 665, 830, 1030, 1265, 1530, 1830]

export function levelOf(stars: number): { level: number; current: number; next: number | null } {
  let level = 0
  while (level + 1 < LEVEL_STARS.length && stars >= LEVEL_STARS[level + 1]) level++
  return { level, current: LEVEL_STARS[level], next: LEVEL_STARS[level + 1] ?? null }
}

export function minutesOn(sessions: Session[], day: string): number {
  return sessions.filter((s) => dayKey(s.startedAt) === day).reduce((a, s) => a + s.durationMs, 0) / 60000
}

/**
 * Consecutive days that met the daily goal, ending today (or yesterday, if today's goal
 * isn't met yet — the streak isn't lost until the day is over).
 */
export function streak(sessions: Session[], goalMinutes: number, now = Date.now()): number {
  const perDay = new Map<string, number>()
  for (const s of sessions) perDay.set(dayKey(s.startedAt), (perDay.get(dayKey(s.startedAt)) ?? 0) + s.durationMs / 60000)
  const met = (d: Date) => (perDay.get(dayKey(d.getTime())) ?? 0) >= goalMinutes

  const day = new Date(now)
  day.setHours(12, 0, 0, 0) // noon avoids DST edge cases when stepping back a day
  if (!met(day)) day.setDate(day.getDate() - 1)
  let n = 0
  while (met(day)) {
    n++
    day.setDate(day.getDate() - 1)
  }
  return n
}
