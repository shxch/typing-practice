// Wallpapers added from the app.
//
// The list (id, name) is part of the synced settings. The images are stored in this browser
// (IndexedDB) and in the private data repo under wallpapers/, so other devices can fetch them.
// Uploads and deletions queue up and run during sync, so adding works offline too.

import { useEffect, useState } from 'react'
import { isConfigured, useApp } from '../store/app'
import { GitHubClient } from '../sync/github'
import { idbDelete, idbGet, idbPut } from './idb'

const MAX_SIDE = 2400
const THUMB_SIDE = 480
/** Keep each image well under GitHub's 1 MB comfortable size for the Contents API. */
const MAX_BYTES = 900 * 1024

const fullPath = (id: string) => `wallpapers/${id}.jpg`
const thumbPath = (id: string) => `wallpapers/${id}.thumb.jpg`
const thumbKey = (id: string) => `${id}.thumb`

async function toJpeg(bitmap: ImageBitmap, maxSide: number, maxBytes = Infinity): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  for (let q = 0.85; ; q -= 0.1) {
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', q))
    if (blob.size <= maxBytes || q < 0.45) return blob
  }
}

/** Resize, compress and store a picked image; it syncs to the data repo in the background. */
export async function addWallpaper(file: File): Promise<void> {
  const bitmap = await createImageBitmap(file)
  const [full, thumb] = await Promise.all([toJpeg(bitmap, MAX_SIDE, MAX_BYTES), toJpeg(bitmap, THUMB_SIDE)])
  bitmap.close()
  const id = 'u' + crypto.randomUUID().slice(0, 8)
  await idbPut(id, full)
  await idbPut(thumbKey(id), thumb)
  const name = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 40)
  const st = useApp.getState()
  st.updateSettings({ customWallpapers: [...st.shared.settings.customWallpapers, { id, name, addedAt: Date.now() }] })
  useApp.setState((s) => ({ wallpaperOps: [...s.wallpaperOps, { op: 'put', id }] }))
}

export async function removeWallpaper(id: string): Promise<void> {
  const st = useApp.getState()
  const s = st.shared.settings
  st.updateSettings({
    customWallpapers: s.customWallpapers.filter((w) => w.id !== id),
    ...(s.wallpaper === 'img-' + id || s.wallpaper === id ? { wallpaper: 'gradient-lavender' } : {}),
  })
  useApp.setState((x) => ({
    // A delete cancels a pending upload of the same picture.
    wallpaperOps: [...x.wallpaperOps.filter((o) => o.id !== id), { op: 'delete', id }],
  }))
  forget(id)
  await idbDelete(id)
  await idbDelete(thumbKey(id))
}

/** Run queued uploads/deletions against the data repo. Called by the sync runner. */
export async function flushWallpaperOps(client: GitHubClient): Promise<void> {
  for (const op of useApp.getState().wallpaperOps) {
    if (op.kind === 'badge') {
      // Left over from when badge pictures could be uploaded; nothing to do.
    } else if (op.op === 'put') {
      const [full, thumb] = await Promise.all([idbGet(op.id), idbGet(thumbKey(op.id))])
      if (full && thumb) {
        await client.putBlob(fullPath(op.id), full, `壁纸：添加 ${op.id}`)
        await client.putBlob(thumbPath(op.id), thumb, `壁纸：添加 ${op.id} 缩略图`)
      }
    } else {
      await client.deleteFile(fullPath(op.id), `壁纸：删除 ${op.id}`)
      await client.deleteFile(thumbPath(op.id), `壁纸：删除 ${op.id} 缩略图`)
    }
    useApp.setState((s) => ({ wallpaperOps: s.wallpaperOps.filter((o) => o !== op) }))
  }
}

// ---- object URLs for display ----

const urls = new Map<string, string>()
const loading = new Map<string, Promise<string | null>>()

function forget(id: string) {
  for (const key of [id, thumbKey(id)]) {
    const u = urls.get(key)
    if (u) URL.revokeObjectURL(u)
    urls.delete(key)
    loading.delete(key)
  }
}

/** Blob URL for a stored image, fetching it from the data repo the first time on a new device. */
function load(key: string, path: string): Promise<string | null> {
  if (urls.has(key)) return Promise.resolve(urls.get(key)!)
  if (!loading.has(key)) {
    const p = (async () => {
      let blob = await idbGet(key)
      const cfg = useApp.getState().config
      if (!blob && isConfigured(cfg)) {
        blob = (await new GitHubClient(cfg).getBlob(path).catch(() => null)) ?? undefined
        if (blob) await idbPut(key, blob)
      }
      if (!blob) {
        loading.delete(key) // try again later (e.g. not uploaded yet by the other device)
        return null
      }
      const url = URL.createObjectURL(blob)
      urls.set(key, url)
      return url
    })()
    loading.set(key, p)
  }
  return loading.get(key)!
}

export interface LoadedCustom {
  id: string
  name: string
  url: string | null
  thumb: string | null
}

/** Custom wallpapers with display URLs (null until loaded). */
export function useCustomWallpapers(): LoadedCustom[] {
  const list = useApp((s) => s.shared.settings.customWallpapers)
  const status = useApp((s) => s.status)
  const [, bump] = useState(0)

  useEffect(() => {
    let alive = true
    for (const w of list) {
      if (!urls.has(w.id)) void load(w.id, fullPath(w.id)).then(() => alive && bump((n) => n + 1))
      if (!urls.has(thumbKey(w.id))) void load(thumbKey(w.id), thumbPath(w.id)).then(() => alive && bump((n) => n + 1))
    }
    return () => {
      alive = false
    }
    // Re-check after each sync: another device may have uploaded the picture by now.
  }, [list, status])

  return list.map((w) => ({ id: w.id, name: w.name, url: urls.get(w.id) ?? null, thumb: urls.get(thumbKey(w.id)) ?? null }))
}
