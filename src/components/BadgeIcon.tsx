import type { Badge } from '../rewards/badges'

/** Built-in badge pictures: src/assets/badges/<badge id>.webp */
const BUILT_IN: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob('../assets/badges/*.{webp,png,jpg,jpeg,avif}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>,
  ).map(([path, url]) => [path.replace(/^.*\//, '').replace(/\.[^.]+$/, ''), url]),
)

const GOLD = 'conic-gradient(from 200deg, #fde68a, #d97706, #fef3c7, #b45309, #fcd34d, #92400e, #fde68a)'
const SILVER = 'conic-gradient(from 200deg, #e2e8f0, #94a3b8, #f8fafc, #64748b, #cbd5e1, #94a3b8, #e2e8f0)'

/**
 * A badge as a round medallion: a gold rim (silver while not yet earned) around its picture from
 * src/assets/badges, or its emoji icon if there is none.
 */
export function BadgeIcon({ badge, size = 56, dim = false }: { badge: Badge; size?: number; dim?: boolean }) {
  const rim = Math.max(3, Math.round(size * 0.07))
  const src = BUILT_IN[badge.id]
  return (
    <span
      className={`relative inline-flex shrink-0 rounded-full ${dim ? 'opacity-60' : 'shadow-[0_2px_6px_rgba(146,64,14,0.45)]'}`}
      style={{ width: size, height: size, padding: rim, background: dim ? SILVER : GOLD }}
    >
      <span
        className={`flex-1 flex items-center justify-center rounded-full overflow-hidden ring-2 ring-white/80 ${
          dim ? 'grayscale bg-slate-100' : 'bg-gradient-to-b from-amber-50 to-orange-100'
        }`}
      >
        {src ? (
          <img src={src} alt="" draggable={false} className="w-full h-full object-cover" />
        ) : (
          <span className="leading-none" style={{ fontSize: (size - rim * 2) * 0.62 }}>
            {badge.icon}
          </span>
        )}
      </span>
      {!dim && <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-white/35 via-transparent to-transparent" />}
    </span>
  )
}
