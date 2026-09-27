// Theme color from a wallpaper: find its most characteristic vivid hue, then build a
// full light→dark palette in OKLCH (the color space Tailwind v4 itself uses).

export interface Accent {
  /** OKLCH hue in degrees. */
  h: number
  /** OKLCH chroma of the picked color. */
  c: number
}

function toLinear(v: number) {
  v /= 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

/** sRGB (0-255) → OKLCH. */
export function rgbToOklch(r: number, g: number, b: number): { l: number; c: number; h: number } {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)]
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
  const h = (Math.atan2(B, A) * 180) / Math.PI
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h }
}

const BINS = 24

/**
 * The wallpaper's signature hue: pixels are grouped into hue bins weighted by how vivid
 * they are, so a big pink Kirby beats a large but greyish sky. Near-white, near-black and
 * grey pixels are ignored. Returns null for images with no real color.
 */
export function pickAccent(rgba: Uint8ClampedArray): Accent | null {
  const weight = new Float64Array(BINS)
  const sumX = new Float64Array(BINS)
  const sumY = new Float64Array(BINS)
  const chromas: number[][] = Array.from({ length: BINS }, () => [])
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue
    const { l, c, h } = rgbToOklch(rgba[i], rgba[i + 1], rgba[i + 2])
    if (c < 0.05 || l < 0.25 || l > 0.95) continue
    const bin = Math.floor(h / (360 / BINS)) % BINS
    const w = c * c // vivid pixels count much more
    weight[bin] += w
    sumX[bin] += Math.cos((h * Math.PI) / 180) * w
    sumY[bin] += Math.sin((h * Math.PI) / 180) * w
    chromas[bin].push(c)
  }
  // Score each bin together with its neighbours so a hue split across a bin edge still wins.
  let best = -1
  let bestScore = 0
  for (let b = 0; b < BINS; b++) {
    const score = weight[b] + 0.5 * (weight[(b + 1) % BINS] + weight[(b + BINS - 1) % BINS])
    if (score > bestScore) {
      bestScore = score
      best = b
    }
  }
  if (best < 0 || bestScore === 0) return null
  const h = (Math.atan2(sumY[best], sumX[best]) * 180) / Math.PI
  const cs = chromas[best].sort((a, b) => a - b)
  const c = cs[Math.floor(cs.length * 0.75)] ?? 0.15
  return { h: h < 0 ? h + 360 : h, c }
}

/** Lightness per step; 600 is dark enough for white text on buttons. */
const L: Record<number, number> = { 50: 0.97, 100: 0.94, 200: 0.89, 300: 0.81, 400: 0.72, 500: 0.63, 600: 0.54, 700: 0.47, 800: 0.4, 900: 0.34 }
/** Chroma relative to the accent's own (the palette gets calmer toward the extremes). */
const C: Record<number, number> = { 50: 0.12, 100: 0.22, 200: 0.38, 300: 0.62, 400: 0.85, 500: 1, 600: 1, 700: 0.92, 800: 0.8, 900: 0.68 }

export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const

export function palette({ h, c }: Accent): Record<(typeof STEPS)[number], string> {
  // Keep it lively but not neon, and never grey.
  const chroma = Math.min(0.2, Math.max(0.1, c))
  return Object.fromEntries(STEPS.map((s) => [s, `oklch(${L[s]} ${(chroma * C[s]).toFixed(3)} ${h.toFixed(1)})`])) as Record<
    (typeof STEPS)[number],
    string
  >
}
