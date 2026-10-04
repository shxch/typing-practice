import { describe, expect, it } from 'vitest'
import { GitHubClient, GitHubError, isConflict } from '../../src/sync/github'
import { STATE_PATH, mergeSessions, mergeShared, monthOf, sessionPath, sessionsInMonth } from '../../src/sync/merge'
import { syncOnce, type SyncInput } from '../../src/sync/syncer'
import { DEFAULT_SETTINGS, type SharedState } from '../../src/store/types'
import { fakeGitHub } from '../helpers/fakeGitHub'
import { dayAt, makeSession } from '../helpers/session'

const T = dayAt(2026, 9, 27)
const MONTH = monthOf(T)

const shared = (at = 0, patch: Partial<SharedState> = {}): SharedState => ({
  settings: DEFAULT_SETTINGS,
  settingsUpdatedAt: at,
  inProgress: null,
  inProgressUpdatedAt: at,
  ...patch,
})

const input = (p: Partial<SyncInput> = {}): SyncInput => ({ sessions: {}, shared: shared(), shas: {}, dirtyMonths: [], device: 'x', ...p })

describe('merge helpers', () => {
  it('sessions merge as a union', () => {
    const a = makeSession({ id: 'a' })
    const b = makeSession({ id: 'b' })
    expect(Object.keys(mergeSessions({ a }, { b })).sort()).toEqual(['a', 'b'])
  })

  it('shared state is last-writer-wins per field group', () => {
    const local = shared(0, { settings: { ...DEFAULT_SETTINGS, targetWpm: 30 }, settingsUpdatedAt: 5, inProgressUpdatedAt: 1 })
    const remote = shared(0, { settingsUpdatedAt: 2, inProgressUpdatedAt: 9 })
    const m = mergeShared(local, remote)
    expect(m.settings.targetWpm).toBe(30)
    expect(m.settingsUpdatedAt).toBe(5)
    expect(m.inProgressUpdatedAt).toBe(9)
  })

  it('settings from an older app version get defaults for missing fields', () => {
    const { hiddenWallpapers: _h, customWallpapers: _c, dailyGoalRounds: _d, ...old } = DEFAULT_SETTINGS
    const remote = shared(10, { settings: { ...old, targetWpm: 40 } as never })
    const m = mergeShared(shared(1), remote)
    expect(m.settings.targetWpm).toBe(40)
    expect(m.settings.hiddenWallpapers).toEqual([])
    expect(m.settings.customWallpapers).toEqual([])
    expect(m.settings.dailyGoalRounds).toBe(DEFAULT_SETTINGS.dailyGoalRounds)
  })

  it('month buckets use the local month', () => {
    expect(monthOf(dayAt(2026, 1, 1, 0, 1))).toBe('2026-01')
    expect(monthOf(dayAt(2026, 12, 31, 23, 59))).toBe('2026-12')
    expect(sessionPath('2026-09')).toBe('sessions/2026-09.json')
    const all = { a: makeSession({ id: 'a', startedAt: dayAt(2026, 9, 1) }), b: makeSession({ id: 'b', startedAt: dayAt(2026, 10, 1) }) }
    expect(Object.keys(sessionsInMonth(all, '2026-09'))).toEqual(['a'])
  })
})

describe('syncOnce', () => {
  it('two devices that practiced offline both end up with both sessions', async () => {
    const gh = fakeGitHub()
    const mac = input({ sessions: { a: makeSession({ id: 'a', startedAt: T }) }, dirtyMonths: [MONTH], device: 'mac' })
    const tv = input({ sessions: { b: makeSession({ id: 'b', startedAt: T + 1 }) }, dirtyMonths: [MONTH], device: 'tv' })
    const r1 = await syncOnce(gh.client, mac)
    expect(r1.pushedIds).toEqual(['a'])
    const r2 = await syncOnce(gh.client, tv)
    expect(Object.keys(r2.remoteSessions).sort()).toEqual(['a', 'b'])
    const r3 = await syncOnce(gh.client, { ...mac, shas: r1.shas, dirtyMonths: [] })
    expect(Object.keys(r3.remoteSessions)).toContain('b')
  })

  it('never overwrites sessions another device wrote, even with a stale sha', async () => {
    const gh = fakeGitHub()
    await syncOnce(gh.client, input({ sessions: { a: makeSession({ id: 'a', startedAt: T }) }, dirtyMonths: [MONTH] }))
    const r = await syncOnce(
      gh.client,
      input({ sessions: { b: makeSession({ id: 'b', startedAt: T }) }, shas: { [sessionPath(MONTH)]: 'stale' }, dirtyMonths: [MONTH] }),
    )
    expect(r.pushedIds).toEqual(['b'])
    expect(Object.keys(gh.read<{ sessions: object }>(sessionPath(MONTH)).sessions).sort()).toEqual(['a', 'b'])
  })

  it('retries write conflicts and gives up after 4 attempts', async () => {
    const gh = fakeGitHub()
    gh.injectConflicts(3)
    const ok = await syncOnce(gh.client, input({ sessions: { a: makeSession({ id: 'a', startedAt: T }) }, dirtyMonths: [MONTH] }))
    expect(ok.pushedIds).toEqual(['a'])
    gh.injectConflicts(4)
    await expect(
      syncOnce(gh.client, input({ sessions: { b: makeSession({ id: 'b', startedAt: T }) }, dirtyMonths: [MONTH] })),
    ).rejects.toSatisfy(isConflict)
  })

  it('a sync with nothing new writes nothing', async () => {
    const gh = fakeGitHub()
    const first = await syncOnce(gh.client, input({ sessions: { a: makeSession({ id: 'a', startedAt: T }) }, dirtyMonths: [MONTH] }))
    const puts = gh.totalPuts()
    await syncOnce(gh.client, input({ sessions: { a: makeSession({ id: 'a', startedAt: T }) }, shas: first.shas, shared: first.shared }))
    expect(gh.totalPuts()).toBe(puts)
  })

  it('carries an unfinished lesson to the other device, and a finished one never comes back', async () => {
    const gh = fakeGitHub()
    const ip = shared(0, { inProgressUpdatedAt: 10, inProgress: { id: 'x', startedAt: 1, device: 'mac', units: 1, state: {} as never } })
    await syncOnce(gh.client, input({ shared: ip, device: 'mac' }))
    const r = await syncOnce(gh.client, input({ device: 'tv' }))
    expect(r.shared.inProgress?.id).toBe('x')
    await syncOnce(gh.client, input({ shared: shared(0, { inProgressUpdatedAt: 20 }), device: 'tv' }))
    const back = await syncOnce(gh.client, input({ shared: ip, device: 'mac' }))
    expect(back.shared.inProgress).toBeNull()
  })

  it('reads month files larger than 1 MB', async () => {
    const gh = fakeGitHub()
    const sessions: Record<string, ReturnType<typeof makeSession>> = {}
    const pad = 'x'.repeat(2000)
    for (let i = 0; i < 700; i++) sessions[`s${i}-${pad}`] = makeSession({ id: `s${i}-${pad}`, startedAt: T + i })
    gh.write(sessionPath(MONTH), { sessions })
    expect(gh.files.get(sessionPath(MONTH))!.content.length).toBeGreaterThan(1024 * 1024)
    const r = await syncOnce(gh.client, input())
    expect(Object.keys(r.remoteSessions)).toHaveLength(700)
  })

  it('keeps non-ASCII text intact (device names, wallpaper names)', async () => {
    const gh = fakeGitHub()
    const s = shared(5, { settings: { ...DEFAULT_SETTINGS, customWallpapers: [{ id: 'u1', name: '我的龙 🐉', addedAt: 1 }] } })
    await syncOnce(gh.client, input({ shared: s, device: '家里电脑' }))
    const r = await syncOnce(gh.client, input())
    expect(r.shared.settings.customWallpapers[0].name).toBe('我的龙 🐉')
    expect(gh.read<SharedState>(STATE_PATH).settings.customWallpapers[0].name).toBe('我的龙 🐉')
  })

  it('ignores non-json files and folders in sessions/', async () => {
    const gh = fakeGitHub()
    gh.files.set('sessions/README.md', { content: 'hi', sha: 'r' })
    await expect(syncOnce(gh.client, input())).resolves.toBeTruthy()
  })
})

describe('GitHubClient', () => {
  it('check() explains auth problems', async () => {
    for (const status of [401, 403, 404]) {
      const gh = fakeGitHub({ status })
      const err = await gh.client.check().catch((e) => e)
      expect(err).toBeInstanceOf(GitHubError)
      expect(err.status).toBe(status)
      expect(err.message.length).toBeGreaterThan(0)
    }
  })

  it('check() passes for a reachable repo', async () => {
    await expect(fakeGitHub().client.check()).resolves.toBeUndefined()
  })

  it('putJson to a missing repo gives a readable error', async () => {
    const fetchFn = (async () => new Response('{}', { status: 404 })) as typeof fetch
    const err = await new GitHubClient({ owner: 'o', repo: 'r', token: 't' }, fetchFn).putJson('a.json', {}, null, 'm').catch((e) => e)
    expect(err).toBeInstanceOf(GitHubError)
    expect(err.status).toBe(404)
  })

  it('blobs round-trip and deleting a missing file is fine', async () => {
    const gh = fakeGitHub()
    await gh.client.putBlob('wallpapers/a.jpg', new Blob(['abc']), 'm')
    await gh.client.putBlob('wallpapers/a.jpg', new Blob(['abcd']), 'm') // replace needs the sha
    expect(await (await gh.client.getBlob('wallpapers/a.jpg'))!.text()).toBe('abcd')
    await gh.client.deleteFile('wallpapers/a.jpg', 'm')
    await gh.client.deleteFile('wallpapers/a.jpg', 'm')
    expect(await gh.client.getBlob('wallpapers/a.jpg')).toBeNull()
  })
})
