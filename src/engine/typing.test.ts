import { describe, expect, it } from 'vitest'
import { IDLE_MS, accuracy, avgMs, backspace, createState, typeChar, wpm, type TypingState } from './typing'

const typeAll = (s: TypingState, keys: string, start = 0, step = 200) =>
  [...keys].reduce((st, ch, i) => typeChar(st, ch, start + i * step), s)

describe('stop mode', () => {
  it('advances only on correct keys and finishes', () => {
    let s = createState('ab', 'stop')
    s = typeChar(s, 'x', 0)
    expect(s.pos).toBe(0)
    expect(s.keyStats.a.miss).toBe(1)
    s = typeChar(s, 'a', 100)
    expect(s.marks[0]).toBe('fixed')
    s = typeChar(s, 'b', 300)
    expect(s.done).toBe(true)
    expect(s.marks).toEqual(['fixed', 'ok'])
    expect(accuracy(s)).toBeCloseTo(2 / 3)
  })

  it('only clean, timed hits produce speed samples', () => {
    const s = typeAll(createState('abc', 'stop'), 'abc', 0, 250)
    expect(s.keyStats.a).toEqual({ n: 1, miss: 0, t: 0, ms: 0 }) // first key has no gap
    expect(avgMs(s.keyStats.b)).toBe(250)
    expect(s.elapsedMs).toBe(500)
  })

  it('ignores idle gaps', () => {
    let s = typeChar(createState('ab', 'stop'), 'a', 0)
    s = typeChar(s, 'b', IDLE_MS + 1)
    expect(s.elapsedMs).toBe(0)
    expect(s.keyStats.b.t).toBe(0)
  })

  it('computes wpm from correct characters', () => {
    const s = typeAll(createState('abcdefghijk', 'stop'), 'abcdefghijk', 0, 600)
    // 11 chars in 6000ms => 11/5 words / 0.1 min = 22 wpm
    expect(wpm(s)).toBeCloseTo(22)
  })

  it('ignores backspace', () => {
    const s = typeChar(createState('ab', 'stop'), 'a', 0)
    expect(backspace(s)).toBe(s)
  })
})

describe('backspace mode', () => {
  it('lets errors through and allows fixing', () => {
    let s = createState('ab', 'backspace')
    s = typeChar(s, 'x', 0)
    expect(s.pos).toBe(1)
    expect(s.marks[0]).toBe('err')
    s = backspace(s)
    expect(s.pos).toBe(0)
    expect(s.marks[0]).toBe('pending')
    s = typeChar(s, 'a', 100)
    expect(s.marks[0]).toBe('fixed')
    s = typeChar(s, 'b', 200)
    expect(s.done).toBe(true)
  })
})
