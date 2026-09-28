// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasLocalChanges, useApp } from '../../src/store/app'
import { monthOf, sessionPath } from '../../src/sync/merge'
import { syncNow } from '../../src/sync/runner'
import { fakeGitHub } from '../helpers/fakeGitHub'
import { dayAt, makeSession } from '../helpers/session'
import { configured, resetStore } from '../helpers/store'

let gh: ReturnType<typeof fakeGitHub>

beforeEach(() => {
  gh = fakeGitHub()
  vi.stubGlobal('fetch', gh.fetchFn)
  resetStore()
  useApp.getState().setConfig(configured)
})
afterEach(() => vi.unstubAllGlobals())

const add = (id: string, startedAt = dayAt(2026, 9, 10)) => useApp.getState().addSession(makeSession({ id, startedAt }))

describe('syncNow', () => {
  it('does nothing and says so when not configured', async () => {
    useApp.getState().setConfig({ token: '' })
    await syncNow()
    expect(useApp.getState().status).toBe('unconfigured')
    expect(gh.totalPuts()).toBe(0)
  })

  it('pushes new sessions and ends up with nothing pending', async () => {
    add('a')
    add('b', dayAt(2026, 8, 3))
    await syncNow()
    const st = useApp.getState()
    expect(st.status).toBe('ok')
    expect(st.dirtyMonths).toEqual([])
    expect(hasLocalChanges(st)).toBe(false)
    expect(gh.files.has(sessionPath('2026-09'))).toBe(true)
    expect(gh.files.has(sessionPath('2026-08'))).toBe(true)
  })

  it('stays clean on the next sync and never re-uploads unchanged months', async () => {
    add('a')
    await syncNow()
    const puts = gh.totalPuts()
    for (let i = 0; i < 3; i++) {
      await syncNow()
      expect(useApp.getState().dirtyMonths).toEqual([])
      expect(hasLocalChanges(useApp.getState())).toBe(false)
    }
    expect(gh.totalPuts()).toBe(puts)
  })

  it('pulls sessions from another device', async () => {
    gh.write(sessionPath('2026-09'), { sessions: { z: makeSession({ id: 'z', device: 'tv' }) } })
    await syncNow()
    expect(useApp.getState().sessions.z.device).toBe('tv')
    expect(useApp.getState().dirtyMonths).toEqual([])
  })

  it('a session finished while syncing stays pending until the next sync', async () => {
    add('a')
    const realFetch = gh.fetchFn
    let once = false
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (!once && init?.method === 'PUT') {
        once = true
        add('late', dayAt(2026, 7, 1))
      }
      return realFetch(url, init)
    })
    await syncNow()
    expect(useApp.getState().dirtyMonths).toEqual([monthOf(dayAt(2026, 7, 1))])
    await syncNow()
    expect(useApp.getState().dirtyMonths).toEqual([])
    expect(gh.read<{ sessions: object }>(sessionPath('2026-07')).sessions).toHaveProperty('late')
  })

  it('calls made during a sync coalesce into one follow-up run', async () => {
    add('a')
    const p1 = syncNow()
    const p2 = syncNow()
    const p3 = syncNow()
    expect(p2).toBe(p1)
    expect(p3).toBe(p1)
    await p1
    expect(useApp.getState().status).toBe('ok')
  })

  it('reports offline when the network is down and keeps the work', async () => {
    add('a')
    gh.setOffline(true)
    await syncNow()
    expect(useApp.getState().status).toBe('offline')
    expect(useApp.getState().dirtyMonths).toEqual(['2026-09'])
    gh.setOffline(false)
    await syncNow()
    expect(useApp.getState().status).toBe('ok')
  })

  it('reports token problems in the current language', async () => {
    vi.stubGlobal('fetch', fakeGitHub({ status: 401 }).fetchFn)
    await syncNow()
    expect(useApp.getState().status).toBe('error')
    expect(useApp.getState().statusMessage).toBe('Token 无效或已过期')
    useApp.getState().updateSettings({ lang: 'en' })
    await syncNow()
    expect(useApp.getState().statusMessage).toBe('Token is invalid or expired')
  })

  it('a broken file in the data repo is an error, not "offline"', async () => {
    gh.files.set('state.json', { content: '{not json', sha: 'x' })
    await syncNow()
    expect(useApp.getState().status).toBe('error')
  })

  it('settings changed on another device arrive, with defaults for fields it did not know', async () => {
    const { hiddenWallpapers: _h, ...old } = useApp.getState().shared.settings
    gh.write('state.json', { settings: { ...old, targetWpm: 33 }, settingsUpdatedAt: Date.now() + 1000, inProgress: null, inProgressUpdatedAt: 0 })
    await syncNow()
    expect(useApp.getState().shared.settings.targetWpm).toBe(33)
    expect(useApp.getState().shared.settings.hiddenWallpapers).toEqual([])
  })
})
