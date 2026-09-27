import { useT } from '../i18n'
import { fitFor, wallpaperGroups, type Wallpaper } from '../content/wallpapers'
import { WallpaperLayers, useImageAspect, useViewport } from './Background'

const TILE_W = 176

/** A miniature of how this wallpaper will look on *this* screen, with the page sketched on top. */
function Preview({ w, selected, onPick }: { w: Wallpaper; selected: boolean; onPick: () => void }) {
  const vp = useViewport()
  const aspect = useImageAspect(w.thumb)
  const tileH = Math.round((TILE_W * vp.h) / vp.w)
  const real = w.url ? fitFor(aspect, vp.w, vp.h) : ({ mode: 'cover' } as const)
  const fit = real.mode === 'side' ? { mode: 'side' as const, width: (real.width * TILE_W) / vp.w } : real
  const contentW = fit.mode === 'side' ? TILE_W - fit.width : TILE_W

  return (
    <button
      onClick={onPick}
      title={w.name}
      className={`relative overflow-hidden rounded-xl shrink-0 border-2 transition ${
        selected ? 'border-violet-600 ring-4 ring-violet-200' : 'border-white/80 hover:border-violet-300'
      }`}
      style={{ width: TILE_W, height: tileH }}
    >
      <WallpaperLayers wallpaper={w} fit={fit} url={w.thumb} fixed={false} />
      {/* Sketch of the page: header, typing card, keyboard. */}
      <div className="absolute inset-y-0 left-0 flex flex-col items-center gap-[3px] pt-[6%]" style={{ width: contentW }}>
        <div className="h-[8%] w-[70%] rounded-sm bg-white/80" />
        <div className="h-[22%] w-[70%] rounded-sm bg-white/80" />
        <div className="h-[18%] w-[70%] rounded-sm bg-white/80" />
      </div>
      <div className="absolute bottom-0 inset-x-0 bg-black/35 text-white text-[11px] py-0.5 capitalize">{w.name}</div>
    </button>
  )
}

export function WallpaperPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const t = useT()
  const names = t.wallpaperGroups as Record<string, string>
  return (
    <div className="space-y-4">
      {wallpaperGroups().map(({ group, items }) => (
        <div key={group}>
          <div className="text-sm font-semibold text-slate-600 mb-2">{names[group] ?? group}</div>
          <div className="flex flex-wrap gap-3">
            {items.map((w) => (
              <Preview key={w.id} w={w} selected={value === w.id} onPick={() => onChange(w.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
