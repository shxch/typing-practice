// The unlock curriculum and the progress computed from the session log.
// Everything here is derived from sessions, so merging sessions from two devices
// always yields the same progress.

import { type KeyStats, wpmToMs } from '../engine/typing'

export type Stage = 'A' | 'B' | 'C'

export interface Unit {
  stage: Stage
  chars: string[]
}

const LOWER_START = ['f', 'j', 'd', 'k', 's', 'l', 'a', 'e']
const LOWER_NEXT = 'irtnouhcgmpwybvxqz'.split('')
const CAPITAL_GROUPS = ['ASDFJKLE', 'TIONRH', 'MBCPWG', 'UYVQXZ']
const PUNCTUATION = ['.', ',', "'", '?', '!', '"', ':', ';', '-', '()']

export const UNITS: Unit[] = [
  { stage: 'A', chars: LOWER_START },
  ...LOWER_NEXT.map((c) => ({ stage: 'A' as const, chars: [c] })),
  ...CAPITAL_GROUPS.map((g) => ({ stage: 'B' as const, chars: g.split('') })),
  ...PUNCTUATION.map((p) => ({ stage: 'C' as const, chars: p.split('') })),
]

export const STAGE_NAMES: Record<Stage, string> = {
  A: '小写字母',
  B: '大写字母',
  C: '标点符号',
}

export interface UnlockSettings {
  targetWpm: number
  targetAccuracy: number
  /** Minimum clean, timed hits before a key's speed is trusted. */
  minSamples: number
  /** When set, overrides the computed number of unlocked units. */
  manualUnits: number | null
}

export interface SessionLike {
  startedAt: number
  keyStats: KeyStats
}

/** Smoothed per-key performance across sessions. */
export interface KeyPerf {
  samples: number
  /** Exponential moving average of ms per clean hit. */
  ms: number | null
  /** Exponential moving average of accuracy. */
  acc: number | null
}

export interface Progress {
  unlockedUnits: number
  /** Unlocked units according to the sessions alone (ignores manualUnits). */
  earnedUnits: number
  unlocked: Set<string>
  stage: Stage
  keys: Record<string, KeyPerf>
  /** The key the next lesson should emphasize. */
  focus: string | null
  /** Unlocked keys that still miss the target, most needed first. */
  weak: string[]
  done: boolean
}

const ALPHA = 0.3

export function unitChars(count: number): Set<string> {
  return new Set(UNITS.slice(0, count).flatMap((u) => u.chars))
}

export function meetsTarget(p: KeyPerf | undefined, s: UnlockSettings): boolean {
  if (!p || p.samples < s.minSamples || p.ms === null || p.acc === null) return false
  return p.ms <= wpmToMs(s.targetWpm) && p.acc >= s.targetAccuracy
}

function updatePerf(keys: Record<string, KeyPerf>, stats: KeyStats) {
  for (const [ch, st] of Object.entries(stats)) {
    const cur = keys[ch] ?? { samples: 0, ms: null, acc: null }
    const tries = st.n + st.miss
    const next = { ...cur, samples: cur.samples + st.t }
    if (st.t > 0) {
      const ms = st.ms / st.t
      next.ms = cur.ms === null ? ms : ALPHA * ms + (1 - ALPHA) * cur.ms
    }
    if (tries > 0) {
      const acc = st.n / tries
      next.acc = cur.acc === null ? acc : ALPHA * acc + (1 - ALPHA) * cur.acc
    }
    keys[ch] = next
  }
}

/** Replay sessions in time order, unlocking the next unit whenever all unlocked keys meet the target. */
export function computeProgress(sessions: SessionLike[], s: UnlockSettings): Progress {
  const keys: Record<string, KeyPerf> = {}
  let earned = 1
  const sorted = [...sessions].sort((a, b) => a.startedAt - b.startedAt)
  for (const session of sorted) {
    updatePerf(keys, session.keyStats)
    while (earned < UNITS.length && [...unitChars(earned)].every((c) => meetsTarget(keys[c], s))) {
      earned++
    }
  }

  const unlockedUnits = Math.min(UNITS.length, Math.max(1, s.manualUnits ?? earned))
  const unlocked = unitChars(unlockedUnits)
  const stage = UNITS[unlockedUnits - 1].stage
  const allDone = unlockedUnits === UNITS.length

  // Keys of the current stage (or everything once done) that still need work.
  const active = UNITS.slice(0, unlockedUnits)
    .filter((u) => allDone || u.stage === stage)
    .flatMap((u) => u.chars)
  // Weakest first; on a tie the most recently unlocked key wins.
  const weak = active
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !meetsTarget(keys[c], s))
    .sort((a, b) => weakness(keys[b.c], s) - weakness(keys[a.c], s) || b.i - a.i)
    .map(({ c }) => c)

  const focus = weak[0] ?? (allDone ? slowest(active, keys) : null)
  return {
    unlockedUnits,
    earnedUnits: earned,
    unlocked,
    stage,
    keys,
    focus,
    weak,
    done: allDone && weak.length === 0,
  }
}

/** Higher = needs more practice. Unpracticed keys come first. */
function weakness(p: KeyPerf | undefined, s: UnlockSettings): number {
  if (!p || p.ms === null || p.samples < s.minSamples) return 1000 - (p?.samples ?? 0)
  const speed = p.ms / wpmToMs(s.targetWpm)
  const acc = s.targetAccuracy / Math.max(p.acc ?? 0, 0.5)
  return speed * acc
}

function slowest(chars: string[], keys: Record<string, KeyPerf>): string | null {
  let best: string | null = null
  let bestMs = -1
  for (const c of chars) {
    const ms = keys[c]?.ms ?? Infinity
    if (ms > bestMs) {
      best = c
      bestMs = ms
    }
  }
  return best
}

export function unitLabel(u: Unit): string {
  return u.chars.join(' ')
}
