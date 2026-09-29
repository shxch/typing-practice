// Daily motivation: stars per round, levels, the daily goal and the streak.
// All derived from the session log, so every device agrees.

import { dayKey } from '../lessons/stats'
import type { Session } from '../store/types'

export interface StarRules {
  targetWpm: number
  targetAccuracy: number
}

/** 6 is the hidden rainbow star: never announced, only earned by an outstanding round. */
export type Stars = 1 | 2 | 3 | 4 | 5 | 6

/** One number for a round: speed discounted by mistakes (a "net speed"). */
export const roundScore = (s: Pick<Session, 'wpm' | 'accuracy'>) => s.wpm * s.accuracy

/** Net speed needed for 2 / 3 / 4 / 5 stars, as a share of the target (target speed × target accuracy). */
export const STAR_CUTS = [0.3, 0.5, 0.75, 1] as const

/** The hidden sixth star: net speed at 150% of the target, with 98%+ accuracy. */
export const RAINBOW_CUT = 1.5
export const RAINBOW_ACCURACY = 0.98

/**
 * Stars for a round from its speed and accuracy alone: the net speed (speed × accuracy, so
 * mistakes count against it) as a share of the target. Generous on purpose: 30% of the target
 * is already 2 stars, 50% is 3, 75% is 4, and reaching the target is 5. Beating it by half at 98%+ accuracy is a secret sixth (rainbow) star.
 */
export function starsFor(s: Pick<Session, 'wpm' | 'accuracy'>, r: StarRules): Stars {
  const target = r.targetWpm * r.targetAccuracy
  const score = roundScore(s)
  if (score >= RAINBOW_CUT * target && s.accuracy >= RAINBOW_ACCURACY) return 6
  return (1 + STAR_CUTS.filter((c) => score >= c * target).length) as Stars
}

/** Rounds in the order they were played (ties by id, so every device agrees). */
export const inPlayOrder = <T extends Pick<Session, 'startedAt' | 'id'>>(sessions: T[]): T[] =>
  [...sessions].sort((a, b) => a.startedAt - b.startedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

/** Stars of every round, by session id. */
export function starsByRound(sessions: Session[], r: StarRules): Map<string, Stars> {
  const sorted = inPlayOrder(sessions)
  return new Map(sorted.map((s) => [s.id, starsFor(s, r)]))
}

export function totalStars(sessions: Session[], r: StarRules): number {
  let total = 0
  for (const n of starsByRound(sessions, r).values()) total += n
  return total
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
