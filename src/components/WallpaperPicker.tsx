import { useRef, useState } from 'react'
import { useT } from '../i18n'
import { fitFor, groupWallpapers, useWallpapers, type Wallpaper } from '../content/wallpapers'
import { isConfigured, useApp } from '../store/app'
import { syncNow } from '../sync/runner'
import { addWallpaper, removeWallpaper } from '../wallpapers/custom'
import { WallpaperLayers, useImageAspect, useViewport } from './Background'

const TILE_W = 176

/** A miniature of how this wallpaper will look on *this* screen, with the page sketched on top. */
function Preview({ w, selected, onPick, onRemove }: { w: Wallpaper; selected: boolean; onPick: () => void; onRemove: () => void }) {
  const t = useT()
  const vp = useViewport()
  const aspect = useImageAspect(w.thumb)
  const tileH = Math.round((TILE_W * vp.h) / vp.w)
  const real = w.url ? fitFor(aspect, vp.w, vp.h) : ({ mode: 'cover' } as const)
  const fit = real.mode === 'side' ? { mode: 'side' as const, width: (real.width * TILE_W) / vp.w } : real
  const contentW = fit.mode === 'side' ? TILE_W - fit.width : TILE_W
  const loadingPhoto = w.group === 'mine' && !w.thumb

  return (
    <div className="relative group shrink-0" style={{ width: TILE_W, height: tileH }}>
      <button
        onClick={onPick}
        disabled={loadingPhoto}
        title={w.name}
        className={`absolute inset-0 overflow-hidden rounded-xl border-2 transition ${
          selected ? 'border-theme-600 ring-4 ring-theme-200' : 'border-white/80 hover:border-theme-300'
        }`}
      >
        {loadingPhoto ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-xs text-slate-400">{t.wpLoading}</div>
        ) : (
          <WallpaperLayers wallpaper={w} fit={fit} url={w.thumb} fixed={false} />
        )}
        {/* Sketch of the page: header, typing card, keyboard. */}
        <div className="absolute inset-y-0 left-0 flex flex-col items-center gap-[3px] pt-[6%]" style={{ width: contentW }}>
          <div className="h-[8%] w-[70%] rounded-sm bg-white/80" />
          <div className="h-[22%] w-[70%] rounded-sm bg-white/80" />
          <div className="h-[18%] w-[70%] rounded-sm bg-white/80" />
        </div>
        <div className="absolute bottom-0 inset-x-0 bg-black/35 text-white text-[11px] py-0.5 capitalize truncate px-1">{w.name}</div>
      </button>
      <button
        onClick={onRemove}
        title={w.group === 'mine' ? t.wpDelete : t.wpHide}
        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white shadow border border-slate-200 text-slate-500 text-sm leading-none opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-rose-500 hover:text-white hover:border-rose-500 transition"
      >
        ✕
      </button>
    </div>
  )
}

function AddTile({ height }: { height: number }) {
  const t = useT()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)

  async function add(files: FileList | null) {
    const images = Array.from(files ?? []).filter((f) => f.type.startsWith('image/'))
    if (images.length === 0) return
    setBusy(true)
    try {
      for (const f of images) await addWallpaper(f)
      void syncNow()
    } catch {
      alert(t.wpAddFailed)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <button
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        void add(e.dataTransfer.files)
      }}
      disabled={busy}
      className={`shrink-0 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 text-sm transition ${
        drag ? 'border-theme-500 bg-theme-50 text-theme-700' : 'border-slate-300 bg-white/70 text-slate-500 hover:border-theme-400 hover:text-theme-600'
      }`}
      style={{ width: TILE_W, height }}
    >
      <span className="text-2xl leading-none">{busy ? '…' : '＋'}</span>
      <span>{busy ? t.wpAdding : t.wpAdd}</span>
      <span className="text-[11px] text-slate-400">{t.wpDrop}</span>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => void add(e.target.files)} />
    </button>
  )
}

export function WallpaperPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const t = useT()
  const vp = useViewport()
  const list = useWallpapers()
  const hidden = useApp((s) => s.shared.settings.hiddenWallpapers)
  const synced = useApp((s) => isConfigured(s.config))
  const updateSettings = useApp((s) => s.updateSettings)
  const names = t.wallpaperGroups as Record<string, string>
  const tileH = Math.round((TILE_W * vp.h) / vp.w)

  function remove(w: Wallpaper) {
    if (w.group === 'mine') {
      if (!confirm(t.wpConfirmDelete(w.name))) return
      void removeWallpaper(w.id.replace(/^img-/, '')).then(() => void syncNow())
    } else {
      updateSettings({
        hiddenWallpapers: [...hidden, w.id],
        ...(value === w.id ? { wallpaper: 'gradient-lavender' } : {}),
      })
    }
  }

  return (
    <div className="space-y-4">
      {groupWallpapers(list).map(({ group, items }) => (
        <div key={group}>
          <div className="text-sm font-semibold text-slate-600 mb-2">{names[group] ?? group}</div>
          <div className="flex flex-wrap gap-3">
            {group === 'mine' && <AddTile height={tileH} />}
            {items.map((w) => (
              <Preview key={w.id} w={w} selected={value === w.id} onPick={() => onChange(w.id)} onRemove={() => remove(w)} />
            ))}
          </div>
          {group === 'mine' && <div className="text-xs text-slate-400 mt-2">{synced ? t.wpSyncedNote : t.wpLocalNote}</div>}
        </div>
      ))}
      {hidden.length > 0 && (
        <button onClick={() => updateSettings({ hiddenWallpapers: [] })} className="text-sm text-theme-600 underline">
          {t.wpRestore(hidden.length)}
        </button>
      )}
    </div>
  )
}
