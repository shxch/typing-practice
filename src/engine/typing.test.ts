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

  it('computes wpm from timed correct characters', () => {
    // 11 keys 600ms apart: the first key starts the clock, so 10 chars in 6000ms
    // => 10/5 words / 0.1 min = 20 wpm (a steady 600ms/key is exactly 20 wpm).
    const s = typeAll(createState('abcdefghijk', 'stop'), 'abcdefghijk', 0, 600)
    expect(wpm(s)).toBeCloseTo(20)
  })

  it('does not spike at the start of a round', () => {
    const s = typeAll(createState('abcdef', 'stop'), 'ab', 0, 600)
    expect(wpm(s)).toBeCloseTo(20)
  })

  it('a steady pace reads the same regardless of a break in the middle', () => {
    let s = typeAll(createState('abcdefghij', 'stop'), 'abcde', 0, 600)
    s = typeAll(s, 'fghij', 2400 + IDLE_MS + 1000, 600)
    expect(wpm(s)).toBeCloseTo(20)
  })

  it('time spent on mistakes lowers the speed', () => {
    let s = typeAll(createState('abc', 'stop'), 'ab', 0, 600)
    s = typeChar(s, 'x', 1200)
    s = typeChar(s, 'c', 1800)
    // 2 timed chars over 1800ms
    expect(wpm(s)).toBeCloseTo(2 / 5 / (1800 / 60000))
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

  it('does not double count a character that was deleted and retyped', () => {
    let s = typeAll(createState('abc', 'backspace'), 'ab', 0, 600)
    s = backspace(s)
    s = typeChar(s, 'b', 1200)
    s = typeChar(s, 'c', 1800)
    expect(wpm(s)).toBeCloseTo(2 / 5 / (1800 / 60000))
  })
})
