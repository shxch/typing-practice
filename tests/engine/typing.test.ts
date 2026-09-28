import { describe, expect, it } from 'vitest'
import {
  IDLE_MS,
  accuracy,
  avgMs,
  backspace,
  createState,
  msToWpm,
  resume,
  slowestKeys,
  typeChar,
  wpm,
  wpmToMs,
} from '../../src/engine/typing'
import { typeText } from '../helpers/typist'

describe('createState', () => {
  it('starts with every character pending', () => {
    const s = createState('ab c', 'stop')
    expect(s.marks).toEqual(['pending', 'pending', 'pending', 'pending'])
    expect(s.pos).toBe(0)
    expect(s.done).toBe(false)
    expect(accuracy(s)).toBe(1)
    expect(wpm(s)).toBe(0)
  })
})

describe('stop mode (a mistake must be fixed before moving on)', () => {
  it('a wrong key does not advance and is counted against the expected key', () => {
    let s = createState('fj', 'stop')
    s = typeChar(s, 'd', 1000)
    expect(s.pos).toBe(0)
    expect(s.presses).toBe(1)
    expect(s.correctPresses).toBe(0)
    expect(s.keyStats.f).toEqual({ n: 0, miss: 1, t: 0, ms: 0 })
    expect(s.keyStats.d).toBeUndefined()
  })

  it('a character typed right after a mistake is marked fixed and gives no speed sample', () => {
    let s = createState('fj', 'stop')
    s = typeChar(s, 'f', 1000)
    s = typeChar(s, 'k', 1200)
    s = typeChar(s, 'j', 1400)
    expect(s.marks).toEqual(['ok', 'fixed'])
    expect(s.keyStats.j).toEqual({ n: 1, miss: 1, t: 0, ms: 0 })
    expect(s.done).toBe(true)
    expect(accuracy(s)).toBeCloseTo(1 / 2)
  })

  it('a character mistyped several times counts as one mistake', () => {
    let s = createState('fj', 'stop')
    s = typeChar(s, 'f', 1000)
    s = typeChar(s, 'k', 1200)
    s = typeChar(s, 'l', 1300)
    s = typeChar(s, 'k', 1400)
    expect(s.keyStats.j.miss).toBe(1)
    expect(accuracy(s)).toBeCloseTo(1 / 2)
    s = typeChar(s, 'j', 1500)
    expect(accuracy(s)).toBeCloseTo(1 / 2)
  })

  it('finishes exactly on the last character', () => {
    const { state } = typeText(createState('asdf', 'stop'), 'asd')
    expect(state.done).toBe(false)
    expect(typeChar(state, 'f', 9e6).done).toBe(true)
  })

  it('ignores input once done and non-single characters', () => {
    const { state } = typeText(createState('a', 'stop'), 'a')
    expect(typeChar(state, 'a', 5)).toBe(state)
    const s = createState('a', 'stop')
    expect(typeChar(s, 'Shift', 5)).toBe(s)
    expect(typeChar(s, '', 5)).toBe(s)
  })

  it('backspace does nothing in stop mode', () => {
    const { state } = typeText(createState('asdf', 'stop'), 'as')
    expect(backspace(state)).toBe(state)
  })
})

describe('backspace mode (keep going, fix with Backspace)', () => {
  it('a wrong key advances and is shown as an error', () => {
    let s = createState('ab', 'backspace')
    s = typeChar(s, 'x', 1000)
    expect(s.pos).toBe(1)
    expect(s.marks[0]).toBe('err')
    expect(s.typed).toEqual(['x'])
    expect(s.keyStats.a.miss).toBe(1)
  })

  it('backspace restores the position and retyping marks it fixed', () => {
    let s = createState('ab', 'backspace')
    s = typeChar(s, 'x', 1000)
    s = backspace(s)
    expect(s.pos).toBe(0)
    expect(s.marks[0]).toBe('pending')
    expect(s.typed).toEqual([])
    s = typeChar(s, 'a', 1200)
    expect(s.marks[0]).toBe('fixed')
  })

  it('mistyping the same character again after backspace is still one mistake', () => {
    let s = createState('ab', 'backspace')
    s = typeChar(s, 'x', 1000)
    s = backspace(s)
    s = typeChar(s, 'y', 1100)
    s = backspace(s)
    expect(s.keyStats.a.miss).toBe(1)
    expect(accuracy(s)).toBe(0)
    s = typeChar(s, 'a', 1200)
    s = typeChar(s, 'b', 1300)
    expect(accuracy(s)).toBeCloseTo(1 / 2)
  })

  it('cannot go before the start', () => {
    const s = createState('ab', 'backspace')
    expect(backspace(s)).toBe(s)
  })

  it('does not change once done', () => {
    const { state } = typeText(createState('ab', 'backspace'), 'ab')
    expect(state.done).toBe(true)
    expect(backspace(state)).toBe(state)
  })
})

describe('timing', () => {
  it('the first key is not timed', () => {
    const s = typeChar(createState('ab', 'stop'), 'a', 1000)
    expect(s.elapsedMs).toBe(0)
    expect(s.keyStats.a).toEqual({ n: 1, miss: 0, t: 0, ms: 0 })
    expect(s.timed![0]).toBe(false)
  })

  it('WPM counts only timed characters over the timed time', () => {
    // 11 keys 200 ms apart: 10 timed characters in 2 s -> 10/5 words / (2/60) min = 60 WPM
    const { state } = typeText(createState('aaaaaaaaaaa', 'stop'), 'aaaaaaaaaaa', 200)
    expect(state.elapsedMs).toBe(2000)
    expect(wpm(state)).toBeCloseTo(60)
  })

  it('a break longer than IDLE_MS is excluded', () => {
    let s = createState('abc', 'stop')
    s = typeChar(s, 'a', 0)
    s = typeChar(s, 'b', 100)
    s = typeChar(s, 'c', 100 + IDLE_MS + 1)
    expect(s.elapsedMs).toBe(100)
    expect(s.keyStats.c.t).toBe(0)
    expect(s.timed).toEqual([false, true, false])
  })

  it('a gap exactly at IDLE_MS still counts', () => {
    let s = typeChar(createState('ab', 'stop'), 'a', 0)
    s = typeChar(s, 'b', IDLE_MS)
    expect(s.elapsedMs).toBe(IDLE_MS)
  })

  it('a negative gap (other device\'s clock is ahead) is not timed', () => {
    let s = typeChar(createState('abc', 'stop'), 'a', 50_000)
    s = typeChar(s, 'b', 30_000) // this device's clock is 20 s behind
    expect(s.elapsedMs).toBe(0)
    expect(s.keyStats.b.t).toBe(0)
    expect(s.keyStats.b.ms).toBe(0)
    s = typeChar(s, 'c', 30_200)
    expect(s.elapsedMs).toBe(200)
    expect(wpm(s)).toBeGreaterThan(0)
  })

  it('resume() makes the next key start a fresh timing gap', () => {
    let s = typeChar(createState('abc', 'stop'), 'a', 1000)
    s = resume(s)
    expect(s.lastAt).toBeNull()
    s = typeChar(s, 'b', 1100)
    expect(s.elapsedMs).toBe(0)
  })

  it('same-millisecond keys never produce an infinite speed', () => {
    let s = typeChar(createState('abc', 'stop'), 'a', 1000)
    s = typeChar(s, 'b', 1000)
    const ms = avgMs(s.keyStats.b)
    expect(ms === null || Number.isFinite(msToWpm(ms))).toBe(true)
    expect(Number.isFinite(wpm(s))).toBe(true)
  })

  it('time on wrong presses lowers the speed', () => {
    const clean = typeText(createState('aaaaa', 'stop'), 'aaaaa', 200).state
    let s = createState('aaaaa', 'stop')
    let at = 0
    for (const ch of 'axaaaa') s = typeChar(s, ch, (at += 200))
    expect(wpm(s)).toBeLessThan(wpm(clean))
  })

  it('wpm works for states saved before `timed` existed', () => {
    expect(wpm({ marks: ['ok', 'ok', 'ok', 'pending'], elapsedMs: 60000 })).toBeCloseTo(2 / 5)
  })
})

describe('immutability', () => {
  it('never mutates the input state', () => {
    const s = createState('ab', 'backspace')
    const copy = JSON.stringify(s)
    typeChar(s, 'x', 1)
    typeChar(s, 'a', 1)
    expect(JSON.stringify(s)).toBe(copy)
  })
})

describe('helpers', () => {
  it('msToWpm and wpmToMs are inverses', () => {
    for (const w of [5, 25, 60, 120]) expect(msToWpm(wpmToMs(w))).toBeCloseTo(w)
    expect(wpmToMs(25)).toBe(480)
  })

  it('slowestKeys skips space and untimed keys, slowest first', () => {
    const stats = {
      ' ': { n: 5, miss: 0, t: 5, ms: 5000 },
      a: { n: 2, miss: 0, t: 2, ms: 600 },
      b: { n: 2, miss: 0, t: 2, ms: 800 },
      c: { n: 3, miss: 1, t: 0, ms: 0 },
      d: { n: 1, miss: 0, t: 1, ms: 100 },
    }
    expect(slowestKeys(stats, 2).map((k) => k.ch)).toEqual(['b', 'a'])
  })

  it('accuracy is 1 before any press', () => {
    expect(accuracy({ pos: 0, missed: [false, false] })).toBe(1)
  })
})
