import type { Badge } from '../rewards/badges'

/** Built-in badge pictures: src/assets/badges/<badge id>.webp */
const BUILT_IN: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob('../assets/badges/*.{webp,png,jpg,jpeg,avif}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>,
  ).map(([path, url]) => [path.replace(/^.*\//, '').replace(/\.[^.]+$/, ''), url]),
)

/** A badge's picture: the uploaded image if there is one, then the built-in picture, then the emoji icon. */
export function BadgeIcon({ badge, url, size = 56, dim = false }: { badge: Badge; url?: string | null; size?: number; dim?: boolean }) {
  const style = { width: size, height: size }
  const faded = dim ? 'grayscale opacity-35' : ''
  const src = url || BUILT_IN[badge.id]
  if (src) {
    return <img src={src} alt="" draggable={false} className={`object-contain drop-shadow ${faded}`} style={style} />
  }
  return (
    <span className={`flex items-center justify-center leading-none ${faded}`} style={{ ...style, fontSize: size * 0.72 }}>
      {badge.icon}
    </span>
  )
}
