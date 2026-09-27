// Backgrounds. Built-in gradients plus any image dropped into src/assets/wallpapers/
// (picked up automatically at build time; the file name becomes its id).

export interface Wallpaper {
  id: string
  name: string
  /** CSS background-image value. */
  css: string
  /** Small preview for the picker. */
  thumb: string
  /** Photos need a frosted panel behind text; gradients don't. */
  photo: boolean
}

const GRADIENTS: Wallpaper[] = [
  ['gradient-lavender', 'Lavender', 'linear-gradient(to bottom, #f5f3ff, #f0f9ff)'],
  ['gradient-peach', 'Peach', 'linear-gradient(135deg, #fff1eb, #ace0f9)'],
  ['gradient-mint', 'Mint', 'linear-gradient(135deg, #e0f7ec, #d4f1f9)'],
  ['gradient-sunset', 'Sunset', 'linear-gradient(135deg, #ffecd2, #fcb69f)'],
  ['gradient-candy', 'Candy', 'linear-gradient(135deg, #fbc2eb, #a6c1ee)'],
  ['gradient-night', 'Night sky', 'linear-gradient(160deg, #1e1b4b, #312e81 55%, #6d28d9)'],
].map(([id, name, css]) => ({ id, name, css, thumb: css, photo: false }))

const files = import.meta.glob('../assets/wallpapers/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const PHOTOS: Wallpaper[] = Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, url]) => {
    const file = path.split('/').pop()!
    const id = 'img-' + file.replace(/\.[^.]+$/, '')
    return { id, name: file.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), css: `url("${url}")`, thumb: `url("${url}")`, photo: true }
  })

export const WALLPAPERS: Wallpaper[] = [...GRADIENTS, ...PHOTOS]

export function findWallpaper(id: string): Wallpaper {
  return WALLPAPERS.find((w) => w.id === id) ?? GRADIENTS[0]
}
