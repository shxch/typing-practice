import type { Session } from '../../src/store/types'
import type { KeyStats } from '../../src/engine/typing'

let n = 0

/** A finished round with sensible defaults; override whatever the test cares about. */
export function makeSession(p: Partial<Session> = {}): Session {
  const startedAt = p.startedAt ?? new Date(2026, 8, 1, 10).getTime()
  const durationMs = p.durationMs ?? 60_000
  return {
    id: p.id ?? `s${++n}`,
    startedAt,
    endedAt: p.endedAt ?? startedAt + durationMs,
    device: 'test',
    stage: 'A',
    units: 1,
    chars: 100,
    wpm: 20,
    accuracy: 0.97,
    durationMs,
    keyStats: {},
    ...p,
  }
}

/** Local-time timestamp. `m` is 1-based like a calendar. */
export const dayAt = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime()

/** Key stats where every listed key was typed `hits` times cleanly at `ms` per hit. */
export function statsFor(chars: Iterable<string>, ms: number, hits = 20, miss = 0): KeyStats {
  const out: KeyStats = {}
  for (const c of chars) out[c] = { n: hits, miss, t: hits, ms: ms * hits }
  return out
}
