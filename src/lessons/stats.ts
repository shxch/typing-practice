// Statistics derived from the session log, for the key panel and the stats page.

import { msToWpm } from '../engine/typing'
import type { Session } from '../store/types'

export interface Point {
  /** 1-based lesson number. */
  lesson: number
  value: number
}

export const byTime = (sessions: Session[]) => [...sessions].sort((a, b) => a.startedAt - b.startedAt)

/** Per-lesson typing speed of one key (only lessons where it got timed hits). */
export function keySpeedSeries(sorted: Session[], ch: string): Point[] {
  const out: Point[] = []
  sorted.forEach((s, i) => {
    const k = s.keyStats[ch]
    // ms > 0: sessions recorded before 0 ms gaps were ruled out could hold impossible speeds.
    if (k && k.t > 0 && k.ms > 0) out.push({ lesson: i + 1, value: msToWpm(k.ms / k.t) })
  })
  return out
}

export interface KeySummary {
  hits: number
  misses: number
  accuracy: number | null
  best: number | null
  /** Average speed over the last few lessons that used the key. */
  recent: number | null
}

export function keySummary(sorted: Session[], ch: string, recentLessons = 5): KeySummary {
  let hits = 0
  let misses = 0
  for (const s of sorted) {
    const k = s.keyStats[ch]
    if (!k) continue
    hits += k.n
    misses += k.miss
  }
  const series = keySpeedSeries(sorted, ch)
  const recent = series.slice(-recentLessons)
  return {
    hits,
    misses,
    accuracy: hits + misses > 0 ? hits / (hits + misses) : null,
    best: series.length ? Math.max(...series.map((p) => p.value)) : null,
    recent: recent.length ? recent.reduce((a, p) => a + p.value, 0) / recent.length : null,
  }
}

export interface Totals {
  timeMs: number
  lessons: number
  topWpm: number | null
  avgWpm: number | null
  topAcc: number | null
  avgAcc: number | null
}

export function totals(sessions: Session[]): Totals {
  if (sessions.length === 0) return { timeMs: 0, lessons: 0, topWpm: null, avgWpm: null, topAcc: null, avgAcc: null }
  const sum = (f: (s: Session) => number) => sessions.reduce((a, s) => a + f(s), 0)
  return {
    timeMs: sum((s) => s.durationMs),
    lessons: sessions.length,
    topWpm: Math.max(...sessions.map((s) => s.wpm)),
    avgWpm: sum((s) => s.wpm) / sessions.length,
    topAcc: Math.max(...sessions.map((s) => s.accuracy)),
    avgAcc: sum((s) => s.accuracy) / sessions.length,
  }
}

/** Local calendar day, e.g. "2026-09-27". */
export function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function sessionsOnDay(sessions: Session[], day: string): Session[] {
  return sessions.filter((s) => dayKey(s.startedAt) === day)
}

/** Rounds played per local day. */
export function dailyRounds(sessions: Session[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const s of sessions) out.set(dayKey(s.startedAt), (out.get(dayKey(s.startedAt)) ?? 0) + 1)
  return out
}

/** Last lesson's value and its change against the average of the lessons before it. */
export function lastWithDelta(
  sorted: Session[],
  pick: (s: Session) => number,
  window = 10,
): { value: number; delta: number | null } | null {
  if (sorted.length === 0) return null
  const last = pick(sorted[sorted.length - 1])
  const before = sorted.slice(-window - 1, -1)
  if (before.length === 0) return { value: last, delta: null }
  const avg = before.reduce((a, s) => a + pick(s), 0) / before.length
  return { value: last, delta: last - avg }
}
