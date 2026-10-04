// Pure typing engine: every function returns a new state, nothing touches the DOM.

export type ErrorMode = 'stop' | 'backspace'

/**
 * Per-character stats.
 * n = correct hits, miss = characters mistyped when this char was expected (a character
 * mistyped several times counts once),
 * t = hits that produced a timing sample, ms = total time of those samples.
 */
export interface KeyStat {
  n: number
  miss: number
  t: number
  ms: number
}

export type KeyStats = Record<string, KeyStat>

/**
 * ok      – typed correctly on the first try
 * fixed   – eventually typed correctly after a mistake (stop mode)
 * err     – typed wrong and left wrong (backspace mode)
 * pending – not typed yet
 */
export type Mark = 'ok' | 'fixed' | 'err' | 'pending'

export interface TypingState {
  text: string
  mode: ErrorMode
  pos: number
  marks: Mark[]
  /** What was actually typed at each position (backspace mode shows it). */
  typed: string[]
  /** Positions that had at least one wrong press. */
  missed: boolean[]
  /**
   * Positions whose correct press was timed (not the very first key, not after a break).
   * WPM counts only these, so characters and time always match up.
   * Optional because lessons saved before this field existed don't have it.
   */
  timed?: boolean[]
  keyStats: KeyStats
  presses: number
  correctPresses: number
  /** Active typing time; idle gaps are excluded. */
  elapsedMs: number
  /** Timestamp of the previous counted press; null right after start or resume. */
  lastAt: number | null
  done: boolean
}

/** A gap longer than this is treated as a break and not counted as typing time. */
export const IDLE_MS = 5000

export function createState(text: string, mode: ErrorMode): TypingState {
  return {
    text,
    mode,
    pos: 0,
    marks: Array.from(text, () => 'pending' as Mark),
    typed: [],
    missed: Array.from(text, () => false),
    timed: Array.from(text, () => false),
    keyStats: {},
    presses: 0,
    correctPresses: 0,
    elapsedMs: 0,
    lastAt: null,
    done: false,
  }
}

/** Resuming (e.g. on another device): the next press starts a fresh timing gap. */
export function resume(state: TypingState): TypingState {
  return { ...state, lastAt: null }
}

function bump(stats: KeyStats, ch: string, patch: Partial<KeyStat>): KeyStats {
  const cur = stats[ch] ?? { n: 0, miss: 0, t: 0, ms: 0 }
  return {
    ...stats,
    [ch]: {
      n: cur.n + (patch.n ?? 0),
      miss: cur.miss + (patch.miss ?? 0),
      t: cur.t + (patch.t ?? 0),
      ms: cur.ms + (patch.ms ?? 0),
    },
  }
}

/** Stats patch for a correct hit; only a clean, non-idle hit yields a speed sample. */
function hit(timed: boolean, clean: boolean, gap: number | null): Partial<KeyStat> {
  return timed && clean ? { n: 1, t: 1, ms: gap! } : { n: 1 }
}

function markTimed(state: TypingState, timed: boolean): boolean[] | undefined {
  if (!state.timed) return undefined
  const out = state.timed.slice()
  out[state.pos] = timed
  return out
}

/** Handle a printable character. `now` is a millisecond timestamp. */
export function typeChar(state: TypingState, ch: string, now: number): TypingState {
  if (state.done || ch.length !== 1) return state
  const expected = state.text[state.pos]
  const correct = ch === expected

  const raw = state.lastAt === null ? null : now - state.lastAt
  // A negative gap means the lesson was resumed on a device whose clock is behind: not a real
  // measurement. Same-millisecond keys (coarse timers) count as 1 ms so speeds stay finite.
  const gap = raw === null || raw < 0 ? null : Math.max(1, raw)
  const timed = gap !== null && gap <= IDLE_MS
  const elapsedMs = state.elapsedMs + (timed ? gap! : 0)
  const base = { ...state, presses: state.presses + 1, elapsedMs, lastAt: now }

  if (state.mode === 'stop') {
    if (!correct) {
      const missed = state.missed.slice()
      missed[state.pos] = true
      const keyStats = state.missed[state.pos] ? state.keyStats : bump(state.keyStats, expected, { miss: 1 })
      return { ...base, missed, keyStats }
    }
    const marks = state.marks.slice()
    marks[state.pos] = state.missed[state.pos] ? 'fixed' : 'ok'
    const typed = state.typed.concat(ch)
    const pos = state.pos + 1
    return {
      ...base,
      marks,
      typed,
      pos,
      timed: markTimed(state, timed),
      correctPresses: state.correctPresses + 1,
      keyStats: bump(state.keyStats, expected, hit(timed, !state.missed[state.pos], gap)),
      done: pos >= state.text.length,
    }
  }

  // backspace mode: every press advances the cursor
  const marks = state.marks.slice()
  marks[state.pos] = correct ? (state.missed[state.pos] ? 'fixed' : 'ok') : 'err'
  const missed = state.missed.slice()
  if (!correct) missed[state.pos] = true
  const pos = state.pos + 1
  return {
    ...base,
    marks,
    missed,
    typed: state.typed.concat(ch),
    pos,
    timed: markTimed(state, correct && timed),
    correctPresses: state.correctPresses + (correct ? 1 : 0),
    keyStats: correct
      ? bump(state.keyStats, expected, hit(timed, !state.missed[state.pos], gap))
      : state.missed[state.pos]
        ? state.keyStats
        : bump(state.keyStats, expected, { miss: 1 }),
    done: pos >= state.text.length,
  }
}

export function backspace(state: TypingState): TypingState {
  if (state.done || state.mode !== 'backspace' || state.pos === 0) return state
  const pos = state.pos - 1
  const marks = state.marks.slice()
  marks[pos] = 'pending'
  const timed = state.timed?.slice()
  if (timed) timed[pos] = false
  return { ...state, pos, marks, timed, typed: state.typed.slice(0, pos) }
}

/**
 * Words per minute (5 characters = 1 word).
 *
 * Only correct characters whose time was measured are counted, over exactly the time
 * measured. The first key of a round has no "previous key" to time from, and the key
 * after a long break has its break excluded, so neither is counted — otherwise the
 * characters outnumber the time and the speed comes out too high, especially early on
 * (two keys 0.1s apart used to read as 240 WPM). Time spent on wrong presses is included,
 * so mistakes do lower the speed.
 */
export function wpm(state: Pick<TypingState, 'marks' | 'elapsedMs' | 'timed'>): number {
  if (state.elapsedMs <= 0) return 0
  const correct = state.marks.filter((m, i) => (m === 'ok' || m === 'fixed') && (state.timed?.[i] ?? i > 0)).length
  return correct / 5 / (state.elapsedMs / 60000)
}

/**
 * Share of characters typed right on the first try. A character mistyped several times is
 * one mistake, not several. The character under the cursor counts once it has been missed.
 */
export function accuracy(state: Pick<TypingState, 'pos' | 'missed'>): number {
  const last = state.missed.lastIndexOf(true)
  const attempted = Math.max(state.pos, last + 1)
  if (attempted === 0) return 1
  return 1 - state.missed.filter(Boolean).length / attempted
}

/** Average milliseconds per clean hit, or null if there is no timing sample. */
export function avgMs(stat: KeyStat | undefined): number | null {
  return stat && stat.t > 0 ? stat.ms / stat.t : null
}

/** Characters with the slowest average time in this run, excluding space. */
export function slowestKeys(stats: KeyStats, count = 3): { ch: string; ms: number }[] {
  return Object.entries(stats)
    .filter(([ch]) => ch !== ' ')
    .map(([ch, s]) => ({ ch, ms: avgMs(s) }))
    .filter((x): x is { ch: string; ms: number } => x.ms !== null)
    .sort((a, b) => b.ms - a.ms)
    .slice(0, count)
}

export const msToWpm = (ms: number) => 60000 / ms / 5
export const wpmToMs = (w: number) => 60000 / (w * 5)

/**
 * Numbers as shown on screen: always rounded down, so a displayed 98% or 25 WPM has really
 * been reached (97.9% must not read as 98%). The epsilon keeps 0.57 * 100 from showing as 56.
 */
export const shownPercent = (share: number) => Math.floor(share * 100 + 1e-9)
export const shownWpm = (w: number) => Math.floor(w + 1e-9)
