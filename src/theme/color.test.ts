import { describe, expect, it } from 'vitest'
import { palette, pickAccent, rgbToOklch } from './color'

const pixels = (...colors: [number, number, number, number][]) => {
  const out: number[] = []
  for (const [r, g, b, n] of colors) for (let i = 0; i < n; i++) out.push(r, g, b, 255)
  return new Uint8ClampedArray(out)
}

describe('theme color', () => {
  it('converts to OKLCH', () => {
    const white = rgbToOklch(255, 255, 255)
    expect(white.l).toBeCloseTo(1, 2)
    expect(white.c).toBeLessThan(0.001)
    const red = rgbToOklch(255, 0, 0)
    expect(red.h).toBeGreaterThan(20)
    expect(red.h).toBeLessThan(35)
  })

  it('picks the vivid color over a larger grey area', () => {
    const a = pickAccent(pixels([128, 128, 128, 800], [240, 240, 245, 500], [236, 72, 153, 120]))!
    const pink = rgbToOklch(236, 72, 153)
    expect(Math.abs(a.h - pink.h)).toBeLessThan(8)
  })

  it('returns null for a colorless image', () => {
    expect(pickAccent(pixels([30, 30, 30, 50], [200, 200, 200, 50]))).toBeNull()
  })

  it('builds a light-to-dark palette in the same hue', () => {
    const p = palette({ h: 40, c: 0.15 })
    expect(p[50]).toMatch(/^oklch\(0\.97 [\d.]+ 40\.0\)$/)
    expect(p[900]).toMatch(/^oklch\(0\.34 /)
  })
})
