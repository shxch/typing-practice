// Backgrounds: built-in gradients plus every image in src/assets/wallpapers/
// (added with scripts/add-wallpapers.py; picked up automatically at build time).
// File names are "<group>-<name>", e.g. "kirby-autumn.jpg".
// Wallpapers added in the app itself come from wallpapers/custom.ts.

import { useApp } from '../store/app'
import { useCustomWallpapers } from '../wallpapers/custom'

export interface Wallpaper {
  id: string
  name: string
  group: string
  /** CSS background-image value (gradient or url). */
  css: string
  /** Image URL for photos; null for gradients. */
  url: string | null
  /** Small image for the picker. */
  thumb: string | null
}

const GRADIENTS: Wallpaper[] = [
  ['gradient-lavender', 'Lavender', 'linear-gradient(to bottom, #f5f3ff, #f0f9ff)'],
  ['gradient-peach', 'Peach', 'linear-gradient(135deg, #fff1eb, #ace0f9)'],
  ['gradient-mint', 'Mint', 'linear-gradient(135deg, #e0f7ec, #d4f1f9)'],
  ['gradient-sunset', 'Sunset', 'linear-gradient(135deg, #ffecd2, #fcb69f)'],
  ['gradient-candy', 'Candy', 'linear-gradient(135deg, #fbc2eb, #a6c1ee)'],
  ['gradient-night', 'Night sky', 'linear-gradient(160deg, #1e1b4b, #312e81 55%, #6d28d9)'],
].map(([id, name, css]) => ({ id, name, group: 'gradient', css, url: null, thumb: null }))

const glob = (files: Record<string, string>) =>
  Object.fromEntries(Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace(/\.[^.]+$/, ''), url]))

const FULL = glob(
  import.meta.glob('../assets/wallpapers/*.{jpg,jpeg,png,webp,avif}', { eager: true, query: '?url', import: 'default' }) as Record<
    string,
    string
  >,
)
const THUMBS = glob(
  import.meta.glob('../assets/wallpaper-thumbs/*.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>,
)

const PHOTOS: Wallpaper[] = Object.keys(FULL)
  .sort()
  .map((base) => {
    const dash = base.indexOf('-')
    return {
      id: 'img-' + base,
      name: (dash > 0 ? base.slice(dash + 1) : base).replace(/[-_]+/g, ' '),
      group: dash > 0 ? base.slice(0, dash) : 'other',
      css: `url("${FULL[base]}")`,
      url: FULL[base],
      thumb: THUMBS[base] ?? FULL[base],
    }
  })

export const BUILT_IN: Wallpaper[] = [...GRADIENTS, ...PHOTOS]
export const DEFAULT_WALLPAPER = GRADIENTS[0]

/** Every wallpaper the picker offers: the user's own first, then built-ins they haven't hidden. */
export function useWallpapers(): Wallpaper[] {
  const custom = useCustomWallpapers()
  const hidden = useApp((s) => s.shared.settings.hiddenWallpapers)
  const mine: Wallpaper[] = custom.map((c) => ({
    id: 'img-' + c.id,
    name: c.name,
    group: 'mine',
    css: c.url ? `url("${c.url}")` : DEFAULT_WALLPAPER.css,
    url: c.url,
    thumb: c.thumb,
  }))
  return [...mine, ...BUILT_IN.filter((w) => !hidden.includes(w.id))]
}

export function findWallpaper(list: Wallpaper[], id: string): Wallpaper {
  return list.find((w) => w.id === id) ?? DEFAULT_WALLPAPER
}

/** Groups in display order: the user's own, gradients, then image series alphabetically. */
export function groupWallpapers(list: Wallpaper[]): { group: string; items: Wallpaper[] }[] {
  const groups = Array.from(new Set(['mine', ...list.map((w) => w.group)]))
  return groups.map((group) => ({ group, items: list.filter((w) => w.group === group) }))
}

export type Fit =
  /** Fill the screen (cropping evenly if needed). */
  | { mode: 'cover' }
  /**
   * The picture is much taller than the screen (a portrait wallpaper on a laptop or TV):
   * show it whole and sharp on the right, and move the page into the space on the left.
   */
  | { mode: 'side'; width: number }

/** Content needs at least this much room next to a side picture. */
const MIN_CONTENT = 780
/** Screen and picture shapes can differ by this much before cropping loses too much. */
const MAX_CROP = 1.3

export function fitFor(imageAspect: number | null, screenW: number, screenH: number): Fit {
  if (imageAspect === null) return { mode: 'cover' }
  const screenAspect = screenW / screenH
  if (imageAspect * MAX_CROP < screenAspect) {
    const width = Math.round(imageAspect * screenH)
    if (screenW - width >= MIN_CONTENT) return { mode: 'side', width }
  }
  return { mode: 'cover' }
}
