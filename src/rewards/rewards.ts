// Daily motivation: stars per round, levels, the daily goal and the streak.
// All derived from the session log, so every device agrees.

import { dayKey } from '../lessons/stats'
import type { Session } from '../store/types'

export interface StarRules {
  targetWpm: number
  targetAccuracy: number
}

export type Stars = 1 | 2 | 3 | 4 | 5

/** How many earlier rounds a round is compared with. */
export const STAR_WINDOW = 10
/** With fewer earlier rounds than this, the target speed stands in for them. */
export const STAR_MIN_HISTORY = 3

/** One number for a round: speed discounted by mistakes (a "net speed"). */
export const roundScore = (s: Pick<Session, 'wpm' | 'accuracy'>) => s.wpm * s.accuracy

/** Value at fraction `q` of the sorted list, interpolating between neighbours. */
function quantile(sorted: number[], q: number): number {
  const at = (sorted.length - 1) * q
  const lo = Math.floor(at)
  return sorted[lo] + (sorted[Math.min(lo + 1, sorted.length - 1)] - sorted[lo]) * (at - lo)
}

/**
 * Stars for a round, measured against the player's own recent rounds so every level has a
 * next step. The score (speed × accuracy, so mistakes already count against it) is ranked
 * against the last 10 rounds, aiming at 10% one star, 20% two, 30% three, 20% four and
 * 10% five: 2 above their bottom 10%, 3 above the bottom 30%, 4 above the bottom 60%,
 * 5 in the top 10%. Until there are 3 earlier rounds, 20% / 35% / 50% / 70% of the target
 * score stand in for those, so a beginner is not stuck on one star.
 *
 * `earlier` must be the rounds before this one, oldest first.
 */
export function starsFor(s: Pick<Session, 'wpm' | 'accuracy'>, earlier: Pick<Session, 'wpm' | 'accuracy'>[], r: StarRules): Stars {
  const recent = earlier.slice(-STAR_WINDOW).map(roundScore).sort((a, b) => a - b)
  const target = r.targetWpm * r.targetAccuracy
  const cuts =
    recent.length < STAR_MIN_HISTORY
      ? [0.2 * target, 0.35 * target, 0.5 * target, 0.7 * target]
      : [quantile(recent, 0.1), quantile(recent, 0.4), quantile(recent, 0.7), quantile(recent, 0.9)]
  const score = roundScore(s)
  return (1 + cuts.filter((c) => score >= c).length) as Stars
}

/** Rounds in the order they were played (ties by id, so every device agrees). */
export const inPlayOrder = <T extends Pick<Session, 'startedAt' | 'id'>>(sessions: T[]): T[] =>
  [...sessions].sort((a, b) => a.startedAt - b.startedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

/** Stars of every round, by session id. */
export function starsByRound(sessions: Session[], r: StarRules): Map<string, Stars> {
  const sorted = inPlayOrder(sessions)
  return new Map(sorted.map((s, i) => [s.id, starsFor(s, sorted.slice(Math.max(0, i - STAR_WINDOW), i), r)]))
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
