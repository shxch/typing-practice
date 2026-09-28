// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { Blob as NodeBlob } from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BUILT_IN, DEFAULT_WALLPAPER, findWallpaper, groupWallpapers } from '../../src/content/wallpapers'
import { useApp } from '../../src/store/app'
import { flushWallpaperOps, removeWallpaper } from '../../src/wallpapers/custom'
import { idbDelete, idbGet, idbPut } from '../../src/wallpapers/idb'
import { fakeGitHub } from '../helpers/fakeGitHub'
import { resetStore } from '../helpers/store'

// jsdom's Blob doesn't survive fake-indexeddb's structured clone; browsers' Blobs do.
vi.stubGlobal('Blob', NodeBlob)

beforeEach(() => resetStore())

describe('built-in wallpapers', () => {
  it('have unique ids, and the default is lavender', () => {
    expect(new Set(BUILT_IN.map((w) => w.id)).size).toBe(BUILT_IN.length)
    expect(DEFAULT_WALLPAPER.id).toBe('gradient-lavender')
    expect(BUILT_IN.some((w) => w.group === 'kirby')).toBe(true)
  })

  it('an unknown or hidden id falls back to the default', () => {
    expect(findWallpaper(BUILT_IN, 'nope')).toBe(DEFAULT_WALLPAPER)
    expect(findWallpaper(BUILT_IN, 'gradient-mint').id).toBe('gradient-mint')
  })

  it('groups: mine first, then gradients, then picture series', () => {
    const groups = groupWallpapers(BUILT_IN).map((g) => g.group)
    expect(groups[0]).toBe('mine')
    expect(groups[1]).toBe('gradient')
  })
})

describe('IndexedDB store', () => {
  it('put, get, delete', async () => {
    await idbPut('k', new Blob(['hello']))
    expect(await (await idbGet('k'))!.text()).toBe('hello')
    await idbDelete('k')
    expect(await idbGet('k')).toBeUndefined()
  })
})

describe('custom wallpapers', () => {
  const addFake = async (id: string) => {
    await idbPut(id, new Blob(['full']))
    await idbPut(`${id}.thumb`, new Blob(['thumb']))
    const s = useApp.getState()
    s.updateSettings({ customWallpapers: [...s.shared.settings.customWallpapers, { id, name: id, addedAt: 1 }], wallpaper: `img-${id}` })
    useApp.setState((x) => ({ wallpaperOps: [...x.wallpaperOps, { op: 'put' as const, id }] }))
  }

  it('upload runs during sync and clears the queue', async () => {
    const gh = fakeGitHub()
    await addFake('u1')
    await flushWallpaperOps(gh.client)
    expect(gh.files.has('wallpapers/u1.jpg')).toBe(true)
    expect(gh.files.has('wallpapers/u1.thumb.jpg')).toBe(true)
    expect(useApp.getState().wallpaperOps).toEqual([])
  })

  it('removing cancels a pending upload, resets the selection and deletes remotely', async () => {
    const gh = fakeGitHub()
    await addFake('u2')
    await removeWallpaper('u2')
    const st = useApp.getState()
    expect(st.shared.settings.customWallpapers).toEqual([])
    expect(st.shared.settings.wallpaper).toBe('gradient-lavender')
    expect(st.wallpaperOps).toEqual([{ op: 'delete', id: 'u2' }])
    expect(await idbGet('u2')).toBeUndefined()
    await flushWallpaperOps(gh.client)
    expect(useApp.getState().wallpaperOps).toEqual([])
    expect(gh.totalPuts()).toBe(0)
  })

  it('removing an uploaded one deletes both files from the data repo', async () => {
    const gh = fakeGitHub()
    await addFake('u3')
    await flushWallpaperOps(gh.client)
    await removeWallpaper('u3')
    await flushWallpaperOps(gh.client)
    expect([...gh.files.keys()].filter((k) => k.startsWith('wallpapers/'))).toEqual([])
  })

  it('leftover badge-picture ops are dropped harmlessly', async () => {
    useApp.setState({ wallpaperOps: [{ op: 'put', id: 'b', kind: 'badge' }] })
    await flushWallpaperOps(fakeGitHub().client)
    expect(useApp.getState().wallpaperOps).toEqual([])
  })
})
