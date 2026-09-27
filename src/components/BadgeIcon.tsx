import type { Badge } from '../rewards/badges'

/** Built-in badge pictures: src/assets/badges/<badge id>.webp */
const BUILT_IN: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob('../assets/badges/*.{webp,png,jpg,jpeg,avif}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>,
  ).map(([path, url]) => [path.replace(/^.*\//, '').replace(/\.[^.]+$/, ''), url]),
)

/** A badge's picture from src/assets/badges, or its emoji icon if there is none. */
export function BadgeIcon({ badge, size = 56, dim = false }: { badge: Badge; size?: number; dim?: boolean }) {
  const style = { width: size, height: size }
  const faded = dim ? 'grayscale opacity-35' : ''
  const src = BUILT_IN[badge.id]
  if (src) {
    return <img src={src} alt="" draggable={false} className={`object-contain drop-shadow ${faded}`} style={style} />
  }
  return (
    <span className={`flex items-center justify-center leading-none ${faded}`} style={{ ...style, fontSize: size * 0.72 }}>
      {badge.icon}
    </span>
  )
}
