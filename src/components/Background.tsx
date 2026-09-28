import { useEffect, useRef, useState } from 'react'
import { fitFor, type Fit, type Wallpaper } from '../content/wallpapers'

export function useViewport() {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

const aspectCache = new Map<string, number>()

/** Width / height of an image, once loaded (cached per URL). */
export function useImageAspect(url: string | null) {
  const [aspect, setAspect] = useState<number | null>(() => (url ? aspectCache.get(url) ?? null : null))
  useEffect(() => {
    if (!url) return setAspect(null)
    if (aspectCache.has(url)) return setAspect(aspectCache.get(url)!)
    setAspect(null)
    const img = new Image()
    img.onload = () => {
      aspectCache.set(url, img.naturalWidth / img.naturalHeight)
      setAspect(img.naturalWidth / img.naturalHeight)
    }
    img.src = url
  }, [url])
  return aspect
}

const decoded = new Set<string>()

/**
 * The wallpaper to show: the requested one once its full picture is decoded, the previous
 * one until then. Swapping in an undecoded picture decodes it during paint and stalls the page.
 */
export function useDecodedWallpaper(w: Wallpaper): Wallpaper {
  const ready = !w.url || decoded.has(w.url)
  const last = useRef(w)
  if (ready) last.current = w
  const [, rerender] = useState(0)
  const url = w.url
  useEffect(() => {
    if (!url || decoded.has(url)) return
    let alive = true
    const img = new Image()
    img.src = url
    const done = () => {
      decoded.add(url)
      if (alive) rerender((n) => n + 1)
    }
    // Hidden tabs may put decoding off indefinitely; don't wait for it forever.
    Promise.race([img.decode(), new Promise((r) => setTimeout(r, 1500))]).then(done, done)
    return () => {
      alive = false
    }
  }, [url])
  return last.current
}

/** How the wallpaper sits on this screen; the page layout uses it to make room for a side picture. */
export function useWallpaperFit(w: Wallpaper): Fit {
  const { w: sw, h: sh } = useViewport()
  // The thumbnail has the same shape and loads much faster than the full picture.
  const aspect = useImageAspect(w.thumb)
  return w.url ? fitFor(aspect, sw, sh) : { mode: 'cover' }
}

/** The picture layers for a given fit. Used full-screen (fixed) and in the picker previews (absolute). */
export function WallpaperLayers({ wallpaper, fit, url, fixed }: { wallpaper: Wallpaper; fit: Fit; url: string | null; fixed: boolean }) {
  const pos = fixed ? 'fixed' : 'absolute'
  const bg = url ? `url("${url}")` : wallpaper.css
  if (fit.mode === 'cover') {
    return <div className={`${pos} inset-0 bg-cover bg-center`} style={{ backgroundImage: bg, backgroundColor: 'var(--theme-50)' }} />
  }
  return (
    <>
      {/* Soft, blurred copy fills the screen behind the page. */}
      <div className={`${pos} inset-0 overflow-hidden`} style={{ backgroundColor: 'var(--theme-50)' }}>
        {/* Blurred anyway, so the small thumbnail is enough and much cheaper to redraw. */}
        <div
          className="absolute -inset-10 bg-cover bg-center blur-2xl saturate-150 opacity-80"
          style={{ backgroundImage: wallpaper.thumb ? `url("${wallpaper.thumb}")` : bg }}
        />
      </div>
      {/* The whole picture, sharp, on the right; its left edge fades into the blur. */}
      <div
        className={`${pos} top-0 bottom-0 right-0 bg-contain bg-right bg-no-repeat`}
        style={{
          width: fixed ? fit.width : `${fit.width}px`,
          backgroundImage: bg,
          maskImage: 'linear-gradient(to right, transparent, black 10%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%)',
        }}
      />
    </>
  )
}

/** Fixed full-screen background behind the app. */
export function Background({ wallpaper, fit }: { wallpaper: Wallpaper; fit: Fit }) {
  return (
    <div className="-z-10 fixed inset-0">
      <WallpaperLayers wallpaper={wallpaper} fit={fit} url={wallpaper.url} fixed />
    </div>
  )
}
