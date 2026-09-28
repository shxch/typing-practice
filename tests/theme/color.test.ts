import { describe, expect, it } from 'vitest'
import { STEPS, palette, pickAccent, rgbToOklch } from '../../src/theme/color'
import { niceTicks } from '../../src/components/charts/useWidth'
import { fitFor } from '../../src/content/wallpapers'

const image = (pixels: [number, number, number][], alpha = 255) => {
  const out = new Uint8ClampedArray(pixels.length * 4)
  pixels.forEach(([r, g, b], i) => out.set([r, g, b, alpha], i * 4))
  return out
}
const fill = (n: number, rgb: [number, number, number]) => Array.from({ length: n }, () => rgb)

describe('rgbToOklch', () => {
  it('matches reference values', () => {
    expect(rgbToOklch(255, 255, 255).l).toBeCloseTo(1, 3)
    expect(rgbToOklch(0, 0, 0).l).toBeCloseTo(0, 3)
    expect(rgbToOklch(128, 128, 128).c).toBeCloseTo(0, 3)
    const red = rgbToOklch(255, 0, 0)
    expect(red.l).toBeCloseTo(0.628, 2)
    expect(red.c).toBeCloseTo(0.258, 2)
    expect(red.h).toBeCloseTo(29.2, 0)
    const h = rgbToOklch(0, 0, 255).h
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThan(360)
  })
})

describe('pickAccent', () => {
  it('returns null for grey, white, black or transparent pictures', () => {
    expect(pickAccent(image([...fill(50, [128, 128, 128]), ...fill(50, [255, 255, 255]), ...fill(50, [0, 0, 0])]))).toBeNull()
    expect(pickAccent(image(fill(50, [255, 0, 0]), 0))).toBeNull()
    expect(pickAccent(new Uint8ClampedArray(0))).toBeNull()
  })

  it('a small vivid area beats a large dull one', () => {
    const a = pickAccent(image([...fill(20, [255, 60, 170]), ...fill(200, [150, 160, 175])]))!
    expect(a).not.toBeNull()
    const pink = rgbToOklch(255, 60, 170).h
    expect(Math.abs(a.h - pink)).toBeLessThan(5)
  })

  it('handles hues that wrap around 0°/360°', () => {
    const a = pickAccent(image([...fill(10, [255, 0, 80]), ...fill(10, [255, 20, 40])]))!
    expect(a.h).toBeGreaterThanOrEqual(0)
    expect(a.h).toBeLessThan(360)
  })
})

describe('palette', () => {
  it('has every step, lightest to darkest, with clamped chroma', () => {
    for (const c of [0, 0.15, 0.9]) {
      const p = palette({ h: 200, c })
      const ls = STEPS.map((s) => Number(p[s].match(/oklch\(([\d.]+)/)![1]))
      for (let i = 1; i < ls.length; i++) expect(ls[i]).toBeLessThan(ls[i - 1])
      for (const s of STEPS) {
        const chroma = Number(p[s].split(' ')[1])
        expect(chroma).toBeLessThanOrEqual(0.2)
        expect(chroma).toBeGreaterThan(0)
      }
    }
  })
})

describe('niceTicks', () => {
  it('starts at 0 and covers the max with round steps', () => {
    for (const max of [0.3, 1, 7, 26, 99, 100, 1234]) {
      const t = niceTicks(max)
      expect(t[0]).toBe(0)
      expect(t[t.length - 1]).toBeGreaterThanOrEqual(max)
      expect(t.length).toBeLessThanOrEqual(7)
    }
  })

  it('degenerate input still gives a usable axis', () => {
    for (const max of [0, -5, NaN, Infinity]) {
      const t = niceTicks(max)
      expect(t.length).toBeGreaterThanOrEqual(2)
      expect(t.every(Number.isFinite)).toBe(true)
    }
  })
})

describe('fitFor', () => {
  it('covers the screen unless a portrait picture would be cropped a lot', () => {
    expect(fitFor(null, 1920, 1080)).toEqual({ mode: 'cover' })
    expect(fitFor(16 / 9, 1920, 1080)).toEqual({ mode: 'cover' })
    expect(fitFor(9 / 16, 1920, 1080)).toEqual({ mode: 'side', width: Math.round((9 / 16) * 1080) })
    // not enough room beside it on a small screen
    expect(fitFor(9 / 16, 900, 1080)).toEqual({ mode: 'cover' })
  })
})
