import type { Badge } from '../rewards/badges'

/** Built-in badge pictures: src/assets/badges/<badge id>.webp */
const BUILT_IN: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob('../assets/badges/*.{webp,png,jpg,jpeg,avif}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>,
  ).map(([path, url]) => [path.replace(/^.*\//, '').replace(/\.[^.]+$/, ''), url]),
)

/**
 * Where each picture's dragon head is, so the round frame keeps it in view:
 * [width / height, head centre x, head centre y (fractions of the picture), head radius (fraction of its width)].
 */
const HEADS: Record<string, [aspect: number, x: number, y: number, r: number]> = {
  'accuracy-1': [0.793, 0.42, 0.22, 0.13],
  'accuracy-10': [1.772, 0.08, 0.28, 0.08],
  'accuracy-20': [1.561, 0.1, 0.28, 0.09],
  'accuracy-5': [1.38, 0.1, 0.35, 0.09],
  'keys-19': [1.533, 0.06, 0.3, 0.08],
  'keys-2': [1.631, 0.08, 0.38, 0.07],
  'keys-23': [0.804, 0.5, 0.62, 0.18],
  'keys-33': [0.805, 0.68, 0.32, 0.15],
  'rounds-1': [1.502, 0.73, 0.2, 0.1],
  'rounds-10': [0.796, 0.72, 0.55, 0.22],
  'rounds-100': [0.759, 0.8, 0.15, 0.14],
  'rounds-250': [0.798, 0.55, 0.2, 0.18],
  'rounds-50': [0.946, 0.75, 0.1, 0.12],
  'rounds-500': [0.808, 0.6, 0.12, 0.17],
  'speed-30': [1.652, 0.07, 0.3, 0.08],
  'speed-40': [1.772, 0.08, 0.28, 0.08],
  'speed-50': [1.399, 0.1, 0.2, 0.08],
  'speed-60': [1.434, 0.08, 0.36, 0.07],
  'speed-70': [1.33, 0.1, 0.3, 0.08],
  'stars-1': [0.773, 0.55, 0.12, 0.15],
  'stars-10': [0.804, 0.6, 0.12, 0.18],
  'stars-50': [0.946, 0.5, 0.5, 0],
  'stars-rainbow': [1.596, 0.08, 0.35, 0.07],
  'streak-1': [1.61, 0.07, 0.45, 0.07],
  'streak-100': [0.675, 0.55, 0.35, 0.42],
  'streak-14': [1.373, 0.08, 0.25, 0.08],
  'streak-3': [0.855, 0.8, 0.72, 0.12],
  'streak-30': [1.185, 0.09, 0.3, 0.08],
  'streak-7': [1.293, 0.5, 0.5, 0],
  'time-1': [0.799, 0.72, 0.3, 0.15],
  'time-10': [1.753, 0.08, 0.25, 0.08],
  'time-24': [1.316, 0.5, 0.5, 0],
  'time-5': [0.805, 0.42, 0.33, 0.1],
  'time-50': [1.28, 0.5, 0.5, 0],
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Place a picture inside a 100×100 frame so it covers the frame where it can, but slides past
 * the edge when that is the only way to get the whole head inside the circle.
 */
function placePicture([aspect, fx, fy, r]: [number, number, number, number]) {
  let w = aspect >= 1 ? 100 * aspect : 100
  let h = aspect >= 1 ? 100 : 100 / aspect
  const zoom = Math.min(1, 38 / (r * w || 1)) // a very big head is shrunk to fit
  w *= zoom
  h *= zoom
  const hr = r * w
  const ideal = [50 - fx * w, 50 - fy * h]
  const covered = [clamp(ideal[0], 100 - w, 0), clamp(ideal[1], 100 - h, 0)]
  let left = ideal[0]
  let top = ideal[1]
  for (let t = 0; t <= 1; t += 0.05) {
    const x = covered[0] + (ideal[0] - covered[0]) * t
    const y = covered[1] + (ideal[1] - covered[1]) * t
    if (Math.hypot(x + fx * w - 50, y + fy * h - 50) + hr <= 46) {
      left = x
      top = y
      break
    }
  }
  return { left, top, w, h }
}

/** Fade the picture's edges that fall inside the frame into the blurred backdrop. */
function edgeMask({ left, top, w, h }: { left: number; top: number; w: number; h: number }) {
  const f = 10
  const fade = (dir: string, a: boolean, b: boolean) =>
    `linear-gradient(${dir}, ${a ? '#0000' : '#000'}, #000 ${a ? f : 0}%, #000 ${b ? 100 - f : 100}%, ${b ? '#0000' : '#000'})`
  const gaps = [left > 0.5, left + w < 99.5, top > 0.5, top + h < 99.5]
  if (!gaps.some(Boolean)) return undefined
  const mask = `${fade('to right', gaps[0], gaps[1])}, ${fade('to bottom', gaps[2], gaps[3])}`
  return { maskImage: mask, WebkitMaskImage: mask, maskComposite: 'intersect', WebkitMaskComposite: 'source-in' } as const
}

const GOLD = 'conic-gradient(from 200deg, #fde68a, #d97706, #fef3c7, #b45309, #fcd34d, #92400e, #fde68a)'
const SILVER = 'conic-gradient(from 200deg, #e2e8f0, #94a3b8, #f8fafc, #64748b, #cbd5e1, #94a3b8, #e2e8f0)'

/**
 * A badge as a round medallion: a gold rim (silver while not yet earned) around its picture from
 * src/assets/badges, or its emoji icon if there is none. A secret badge shows only a question mark.
 */
export function BadgeIcon({ badge, size = 56, dim = false, secret = false }: { badge: Badge; size?: number; dim?: boolean; secret?: boolean }) {
  const rim = Math.max(3, Math.round(size * 0.07))
  const src = secret ? undefined : BUILT_IN[badge.id]
  return (
    <span
      className={`relative inline-flex shrink-0 rounded-full ${dim ? 'opacity-60' : 'shadow-[0_2px_6px_rgba(146,64,14,0.45)]'}`}
      style={{ width: size, height: size, padding: rim, background: dim ? SILVER : GOLD }}
    >
      <span
        className={`relative flex-1 flex items-center justify-center rounded-full overflow-hidden ring-2 ring-white/80 ${
          dim ? 'grayscale bg-slate-100' : 'bg-gradient-to-b from-amber-50 to-orange-100'
        }`}
      >
        {src ? (
          <Picture id={badge.id} src={src} blur={size * 0.05} />
        ) : (
          <span className={`leading-none ${secret ? 'font-bold text-slate-400' : ''}`} style={{ fontSize: (size - rim * 2) * 0.62 }}>
            {secret ? '?' : badge.icon}
          </span>
        )}
      </span>
      {!dim && <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-white/35 via-transparent to-transparent" />}
    </span>
  )
}

function Picture({ id, src, blur }: { id: string; src: string; blur: number }) {
  const head = HEADS[id]
  if (!head) return <img src={src} alt="" draggable={false} className="w-full h-full object-cover" />
  const place = placePicture(head)
  const mask = edgeMask(place)
  return (
    <>
      {mask && (
        <img src={src} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover scale-125" style={{ filter: `blur(${blur}px)` }} />
      )}
      <img
        src={src}
        alt=""
        draggable={false}
        className="absolute max-w-none"
        style={{ left: `${place.left}%`, top: `${place.top}%`, width: `${place.w}%`, height: `${place.h}%`, ...mask }}
      />
    </>
  )
}
