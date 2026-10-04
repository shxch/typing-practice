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

export interface UnlockSettings {
  targetWpm: number
  targetAccuracy: number
  /** Minimum clean, timed hits before a key's speed is trusted. */
  minSamples: number
  /**
   * Jump ahead: start from at least this many units. Automatic unlocking carries on from
   * there, so it never gets stuck at the manual position.
   */
  manualUnits: number | null
}

export interface SessionLike {
  startedAt: number
  keyStats: KeyStats
  /** Units unlocked when this round was played (including a manual jump). */
  units?: number
  /**
   * Units earned by practice alone when this round was played (no manual jump).
   * Unlocks never go backwards past it. Older sessions don't have it and fall back to `units`.
   */
  earnedUnits?: number
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
  /** Units unlocked without the manual jump (practice results and past rounds only). */
  earnedUnits: number
  unlocked: Set<string>
  stage: Stage
  keys: Record<string, KeyPerf>
  /** Keys that have reached the target and not clearly slipped since. */
  passed: Set<string>
  /** The weakest unlocked key; the next lesson emphasizes it. */
  focus: string | null
  /** Unlocked keys that haven't passed, most needed first. */
  weak: string[]
  done: boolean
}

/**
 * Smoothing: how much a round moves a key's average. It scales with how often the key came
 * up in that round — ALPHA per REF_HITS hits — so a round with one stray "q" barely moves
 * the needle while a round full of them counts properly.
 */
const ALPHA = 0.3
const REF_HITS = 10
const MAX_WEIGHT = 0.8

const weightFor = (hits: number) => Math.min(MAX_WEIGHT, 1 - (1 - ALPHA) ** (hits / REF_HITS))

/** Characters that need Shift. They're naturally slower, so they get extra time. */
export const SHIFTED = new Set([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '!', '?', '"', ':', '(', ')'])
export const SHIFT_SLACK = 1.3

/** Target milliseconds per hit for a character. */
export function targetMs(ch: string, s: Pick<UnlockSettings, 'targetWpm'>): number {
  return wpmToMs(s.targetWpm) * (SHIFTED.has(ch) ? SHIFT_SLACK : 1)
}

export function unitChars(count: number): Set<string> {
  return new Set(UNITS.slice(0, count).flatMap((u) => u.chars))
}

export function meetsTarget(ch: string, p: KeyPerf | undefined, s: UnlockSettings): boolean {
  if (!p || p.samples < s.minSamples || p.ms === null || p.acc === null) return false
  return p.ms <= targetMs(ch, s) && p.acc >= s.targetAccuracy
}

/**
 * A key that has passed stays passed through the ordinary ups and downs of its average; it is
 * only taken back when it clearly slips: accuracy this far under the target, or this much slower.
 */
export const SLIP_ACCURACY = 0.05
export const SLIP_SPEED = 1.15

export function hasSlipped(ch: string, p: KeyPerf | undefined, s: UnlockSettings): boolean {
  if (!p || p.ms === null || p.acc === null) return false
  return p.acc < s.targetAccuracy - SLIP_ACCURACY || p.ms > targetMs(ch, s) * SLIP_SPEED
}

function updatePerf(keys: Record<string, KeyPerf>, stats: KeyStats) {
  for (const [ch, st] of Object.entries(stats)) {
    const cur = keys[ch] ?? { samples: 0, ms: null, acc: null }
    const tries = st.n + st.miss
    const next = { ...cur, samples: cur.samples + st.t }
    if (st.t > 0 && st.ms > 0) {
      const ms = st.ms / st.t
      const w = weightFor(st.t)
      next.ms = cur.ms === null ? ms : w * ms + (1 - w) * cur.ms
    }
    if (tries > 0) {
      const acc = st.n / tries
      const w = weightFor(tries)
      next.acc = cur.acc === null ? acc : w * acc + (1 - w) * cur.acc
    }
    keys[ch] = next
  }
}

const clampUnits = (n: number) => (Number.isFinite(n) ? Math.min(UNITS.length, Math.max(1, Math.round(n))) : 1)

/**
 * Replay sessions in time order. A key passes when it meets the target and keeps that until it
 * clearly slips; the next unit unlocks once every unlocked key has passed. (Asking all keys to
 * be on target in the same round is far stricter than the target itself, because the averages
 * wobble from round to round.) Unlocks only ever move forward: each round records how far it
 * was, so raising the target later never takes keys away.
 */
export function computeProgress(sessions: SessionLike[], s: UnlockSettings): Progress {
  const sorted = [...sessions].sort((a, b) => a.startedAt - b.startedAt)
  // `manual`: include the unit counts recorded during a manual jump; otherwise practice only.
  const replay = (start: number, manual: boolean) => {
    const keys: Record<string, KeyPerf> = {}
    const passed = new Set<string>()
    let units = start
    for (const session of sorted) {
      const floor = manual ? session.units : (session.earnedUnits ?? session.units)
      units = Math.max(units, clampUnits(floor ?? 1))
      updatePerf(keys, session.keyStats)
      for (const c of Object.keys(session.keyStats)) {
        if (meetsTarget(c, keys[c], s)) passed.add(c)
        else if (hasSlipped(c, keys[c], s)) passed.delete(c)
      }
      while (units < UNITS.length && [...unitChars(units)].every((c) => passed.has(c))) {
        units++
      }
    }
    return { keys, passed, units }
  }

  const auto = replay(1, false)
  const { keys, passed, units: unlockedUnits } =
    s.manualUnits !== null && s.manualUnits > auto.units ? replay(clampUnits(s.manualUnits), true) : auto
  const unlocked = unitChars(unlockedUnits)
  const stage = UNITS[unlockedUnits - 1].stage

  // Unlocking the next unit needs *every* unlocked key to have passed, so look at all of them,
  // not just the current stage: a lowercase key that slipped should get practice too.
  const all = UNITS.slice(0, unlockedUnits).flatMap((u) => u.chars)
  // Weakest first; on a tie the most recently unlocked key wins.
  const weak = all
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !passed.has(c))
    .sort((a, b) => weakness(b.c, keys[b.c], s) - weakness(a.c, keys[a.c], s) || b.i - a.i)
    .map(({ c }) => c)

  // Even when every key has passed, keep polishing the slowest one.
  const focus = weak[0] ?? slowest(all, keys, s)
  return {
    unlockedUnits,
    earnedUnits: auto.units,
    unlocked,
    stage,
    keys,
    passed,
    focus,
    weak,
    done: unlockedUnits === UNITS.length && weak.length === 0,
  }
}

/** Higher = needs more practice. Keys without enough practice yet come first. */
function weakness(ch: string, p: KeyPerf | undefined, s: UnlockSettings): number {
  if (!p || p.ms === null || p.samples < s.minSamples) return 1000 - (p?.samples ?? 0)
  const speed = p.ms / targetMs(ch, s)
  const acc = s.targetAccuracy / Math.max(p.acc ?? 0, 0.5)
  return speed * acc
}

/** Slowest key relative to its own target (so capitals aren't always picked just for needing Shift). */
function slowest(chars: string[], keys: Record<string, KeyPerf>, s: UnlockSettings): string | null {
  let best: string | null = null
  let bestRatio = -1
  for (const c of chars) {
    const ms = keys[c]?.ms
    const ratio = ms == null ? Infinity : ms / targetMs(c, s)
    if (ratio > bestRatio) {
      best = c
      bestRatio = ratio
    }
  }
  return best
}

export function unitLabel(u: Unit): string {
  return u.chars.join(' ')
}
