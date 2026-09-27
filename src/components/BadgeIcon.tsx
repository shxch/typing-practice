import type { Badge } from '../rewards/badges'

/** A badge's picture: the uploaded image if there is one, otherwise the built-in icon. */
export function BadgeIcon({ badge, url, size = 56, dim = false }: { badge: Badge; url?: string | null; size?: number; dim?: boolean }) {
  const style = { width: size, height: size }
  const faded = dim ? 'grayscale opacity-35' : ''
  if (url) {
    return <img src={url} alt="" draggable={false} className={`object-contain drop-shadow ${faded}`} style={style} />
  }
  return (
    <span className={`flex items-center justify-center leading-none ${faded}`} style={{ ...style, fontSize: size * 0.72 }}>
      {badge.icon}
    </span>
  )
}
