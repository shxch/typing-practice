import { useEffect } from 'react'
import type { Wallpaper } from '../content/wallpapers'
import { STEPS, palette, pickAccent, type Accent } from './color'

/** Hand-picked theme colors for the built-in gradients. */
const GRADIENT_ACCENTS: Record<string, Accent> = {
  'gradient-lavender': { h: 293, c: 0.2 },
  'gradient-peach': { h: 235, c: 0.13 },
  'gradient-mint': { h: 170, c: 0.13 },
  'gradient-sunset': { h: 42, c: 0.16 },
  'gradient-candy': { h: 330, c: 0.16 },
  'gradient-night': { h: 285, c: 0.19 },
}
const FALLBACK = GRADIENT_ACCENTS['gradient-lavender']

const CACHE_KEY = 'typing-practice:theme-cache'
const cache = new Map<string, Accent>(
  (() => {
    try {
      return Object.entries(JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, Accent>)
    } catch {
      return []
    }
  })(),
)

function remember(id: string, a: Accent) {
  cache.set(id, a)
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(cache)))
  } catch {
    /* cache is only an optimization */
  }
}

/** Sample a small copy of the image and find its signature hue. */
async function accentOfImage(url: string): Promise<Accent | null> {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = url
  await img.decode()
  const canvas = document.createElement('canvas')
  const scale = 64 / Math.max(img.naturalWidth, img.naturalHeight)
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return pickAccent(ctx.getImageData(0, 0, canvas.width, canvas.height).data)
}

function apply(a: Accent) {
  const p = palette(a)
  const root = document.documentElement.style
  for (const s of STEPS) root.setProperty(`--theme-${s}`, p[s])
}

/** Keep the page's theme color in step with the wallpaper. */
export function useWallpaperTheme(w: Wallpaper) {
  useEffect(() => {
    if (GRADIENT_ACCENTS[w.id]) return apply(GRADIENT_ACCENTS[w.id])
    const cached = cache.get(w.id)
    if (cached) return apply(cached)
    if (!w.thumb) return apply(FALLBACK)
    let alive = true
    accentOfImage(w.thumb)
      .then((a) => {
        if (!alive) return
        const accent = a ?? FALLBACK
        remember(w.id, accent)
        apply(accent)
      })
      .catch(() => alive && apply(FALLBACK))
    return () => {
      alive = false
    }
  }, [w.id, w.thumb])
}
