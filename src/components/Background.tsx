import { useEffect, useState } from 'react'
import type { Wallpaper } from '../content/wallpapers'

/** If the image and screen shapes differ by more than this, show the whole image instead of cropping it. */
const MAX_CROP_RATIO = 1.3

function useViewportAspect() {
  const [aspect, setAspect] = useState(() => window.innerWidth / window.innerHeight)
  useEffect(() => {
    const onResize = () => setAspect(window.innerWidth / window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return aspect
}

function useImageAspect(url: string | null) {
  const [aspect, setAspect] = useState<number | null>(null)
  useEffect(() => {
    setAspect(null)
    if (!url) return
    const img = new Image()
    img.onload = () => setAspect(img.naturalWidth / img.naturalHeight)
    img.src = url
  }, [url])
  return aspect
}

/**
 * Fixed full-screen background.
 * Wallpapers come in any size: when the image is roughly screen-shaped it simply covers the
 * screen; when it's much taller or wider (e.g. a portrait picture on a TV) it is shown whole,
 * centered, over a blurred, enlarged copy of itself so there are no empty bars.
 */
export function Background({ wallpaper }: { wallpaper: Wallpaper }) {
  const url = wallpaper.photo ? wallpaper.css.match(/url\("(.*)"\)/)?.[1] ?? null : null
  const viewport = useViewportAspect()
  const image = useImageAspect(url)
  const mismatch = image !== null && Math.max(image / viewport, viewport / image) > MAX_CROP_RATIO

  const layer = 'fixed inset-0 -z-10 bg-center bg-no-repeat'
  if (!mismatch) {
    return <div className={`${layer} bg-cover`} style={{ backgroundImage: wallpaper.css, backgroundColor: '#f5f3ff' }} />
  }
  return (
    <>
      <div
        className={`${layer} bg-cover scale-110 blur-2xl brightness-90`}
        style={{ backgroundImage: wallpaper.css, backgroundColor: '#f5f3ff' }}
      />
      <div className={`${layer} bg-contain`} style={{ backgroundImage: wallpaper.css }} />
    </>
  )
}
