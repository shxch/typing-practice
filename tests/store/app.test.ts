// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { hasLocalChanges, isConfigured, useApp } from '../../src/store/app'
import { DEFAULT_SETTINGS } from '../../src/store/types'
import { dayAt, makeSession } from '../helpers/session'
import { resetStore } from '../helpers/store'

beforeEach(() => resetStore())

const persisted = () => JSON.parse(localStorage.getItem('typing-practice')!)

describe('actions', () => {
  it('addSession stores it and marks its month dirty once', () => {
    const { addSession } = useApp.getState()
    addSession(makeSession({ id: 'a', startedAt: dayAt(2026, 9, 1) }))
    addSession(makeSession({ id: 'b', startedAt: dayAt(2026, 9, 2) }))
    expect(Object.keys(useApp.getState().sessions)).toEqual(['a', 'b'])
    expect(useApp.getState().dirtyMonths).toEqual(['2026-09'])
    expect(hasLocalChanges(useApp.getState())).toBe(true)
  })

  it('settings and lesson changes are stamped so sync knows they are newer', () => {
    useApp.getState().updateSettings({ targetWpm: 30 })
    useApp.getState().setInProgress(null)
    const sh = useApp.getState().shared
    expect(sh.settings.targetWpm).toBe(30)
    expect(sh.settings.lessonWords).toBe(DEFAULT_SETTINGS.lessonWords)
    expect(sh.settingsUpdatedAt).toBeGreaterThan(0)
    expect(sh.inProgressUpdatedAt).toBeGreaterThan(0)
    expect(hasLocalChanges(useApp.getState())).toBe(true)
  })

  it('isConfigured needs owner, repo and token', () => {
    const c = useApp.getState().config
    expect(isConfigured({ ...c, token: '' })).toBe(false)
    expect(isConfigured({ ...c, owner: 'o', repo: 'r', token: 't' })).toBe(true)
  })
})

describe('persistence', () => {
  it('saves data but not runtime sync status', () => {
    useApp.getState().addSession(makeSession({ id: 'a' }))
    useApp.setState({ status: 'syncing', statusMessage: 'x' })
    const p = persisted()
    expect(p.state.sessions.a).toBeTruthy()
    expect(p.state.status).toBeUndefined()
    expect(p.state.statusMessage).toBeUndefined()
  })

  it('the token lives in device config, never in the synced state', () => {
    useApp.getState().setConfig({ token: 'secret' })
    expect(JSON.stringify(useApp.getState().shared)).not.toContain('secret')
  })

  it('old saved data gets defaults for new settings and config fields and is migrated', async () => {
    const old = {
      state: {
        sessions: {},
        shared: { settings: { targetWpm: 40 }, settingsUpdatedAt: 1, inProgress: null, inProgressUpdatedAt: 1 },
        config: { owner: 'x', repo: 'y', token: 'z', device: 'd', sound: true, volume: 1, soundStyle: 'kalimba' },
      },
      version: 1,
    }
    localStorage.setItem('typing-practice', JSON.stringify(old))
    await useApp.persist.rehydrate()
    const st = useApp.getState()
    expect(st.shared.settings.targetWpm).toBe(40)
    expect(st.shared.settings.hiddenWallpapers).toEqual([])
    expect(st.shared.settings.dailyGoalRounds).toBe(DEFAULT_SETTINGS.dailyGoalRounds)
    expect(st.config.soundStyle).toBe('phone') // v2 migration
    expect(st.config.showKeyboard).toBe(true)
    expect(st.remoteStamp).toEqual({ settings: 0, inProgress: 0 })
    expect(st.wallpaperOps).toEqual([])
  })
})
