// @vitest-environment jsdom
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeSession } from '../helpers/session'

const persisted = () => JSON.parse(localStorage.getItem('typing-practice')!)

/** A fresh copy of the store module, as after a page load. */
async function boot() {
  vi.resetModules()
  const app = await import('../../src/store/app')
  const { idbGet } = await import('../../src/wallpapers/idb')
  return { ...app, stored: () => idbGet<Record<string, unknown>>('app:sessions') }
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('indexedDB', new IDBFactory())
})

describe('practice log in IndexedDB', () => {
  it('moves sessions saved in localStorage by older versions', async () => {
    const a = makeSession({ id: 'a' })
    localStorage.setItem('typing-practice', JSON.stringify({ state: { sessions: { a }, shas: { 'sessions/2026-09.json': 'x' } }, version: 2 }))
    const { useApp, loadSessions, stored } = await boot()
    await loadSessions()
    expect(useApp.getState().sessions.a).toEqual(a)
    expect(await stored()).toEqual({ a })
    expect(persisted().state.sessions).toBeUndefined()
    expect(useApp.getState().shas).toEqual({ 'sessions/2026-09.json': 'x' })
  })

  it('saves new sessions there and loads them on the next start', async () => {
    const first = await boot()
    await first.loadSessions()
    first.useApp.getState().addSession(makeSession({ id: 'a' }))
    await vi.waitFor(async () => expect(await first.stored()).toHaveProperty('a'))
    expect(persisted().state.sessions).toBeUndefined()
    expect(persisted().state.dirtyMonths).toHaveLength(1)

    const second = await boot()
    expect(second.useApp.getState().sessions).toEqual({})
    await second.loadSessions()
    expect(Object.keys(second.useApp.getState().sessions)).toEqual(['a'])
  })

  it('pulls everything again when the log has gone missing', async () => {
    localStorage.setItem('typing-practice', JSON.stringify({ state: { shas: { 'sessions/2026-09.json': 'x' } }, version: 2 }))
    const { useApp, loadSessions } = await boot()
    await loadSessions()
    expect(useApp.getState().shas).toEqual({})
  })

  it('keeps using localStorage when IndexedDB does not work', async () => {
    vi.stubGlobal('indexedDB', { open: () => { throw new Error('blocked') } })
    const { useApp, loadSessions } = await boot()
    await loadSessions()
    useApp.getState().addSession(makeSession({ id: 'a' }))
    expect(persisted().state.sessions.a).toBeTruthy()
  })
})
