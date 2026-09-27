import { describe, expect, it } from 'vitest'
import type { Session, SharedState } from '../store/types'
import { DEFAULT_SETTINGS } from '../store/types'
import { GitHubClient } from './github'
import { mergeShared, monthOf } from './merge'
import { syncOnce } from './syncer'

const toB64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)))
const fromB64 = (b: string) => new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0)))

/** In-memory fake of the GitHub Contents API with sha checks. */
function fakeGitHub() {
  const files = new Map<string, { content: string; sha: string }>()
  let n = 0
  const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url).split('/contents/')[1]
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    if (!init?.method || init.method === 'GET') {
      const f = files.get(path)
      if (f) return json(200, { content: toB64(f.content), sha: f.sha })
      const dir = [...files.keys()].filter((k) => k.startsWith(path + '/'))
      if (dir.length === 0) return json(404, { message: 'Not Found' })
      return json(
        200,
        dir.map((k) => ({ name: k.split('/').pop(), path: k, sha: files.get(k)!.sha, type: 'file' })),
      )
    }
    const body = JSON.parse(String(init.body))
    const existing = files.get(path)
    if (existing && body.sha !== existing.sha) return json(409, { message: 'sha mismatch' })
    if (!existing && body.sha) return json(422, { message: 'no file' })
    const sha = `sha${++n}`
    files.set(path, { content: fromB64(body.content), sha })
    return json(200, { content: { sha } })
  }
  return { files, client: new GitHubClient({ owner: 'o', repo: 'r', token: 't' }, fetchFn as typeof fetch) }
}

const session = (id: string, startedAt: number): Session => ({
  id,
  startedAt,
  endedAt: startedAt + 1000,
  device: 'x',
  stage: 'A',
  units: 1,
  chars: 10,
  wpm: 20,
  accuracy: 1,
  durationMs: 1000,
  keyStats: {},
})

const shared = (at = 0): SharedState => ({
  settings: DEFAULT_SETTINGS,
  settingsUpdatedAt: at,
  inProgress: null,
  inProgressUpdatedAt: at,
})

const T = new Date(2026, 8, 27).getTime()
const MONTH = monthOf(T)

describe('mergeShared', () => {
  it('takes the newer value per field group', () => {
    const local = { ...shared(), settings: { ...DEFAULT_SETTINGS, targetWpm: 30 }, settingsUpdatedAt: 5, inProgressUpdatedAt: 1 }
    const remote = { ...shared(), settingsUpdatedAt: 2, inProgressUpdatedAt: 9 }
    const m = mergeShared(local, remote)
    expect(m.settings.targetWpm).toBe(30)
    expect(m.inProgressUpdatedAt).toBe(9)
  })
})

describe('syncOnce', () => {
  it('two devices that practiced offline end up with both sessions', async () => {
    const { client } = fakeGitHub()
    const mac = { sessions: { a: session('a', T) }, shared: shared(), shas: {}, dirtyMonths: [MONTH], device: 'mac' }
    const tv = { sessions: { b: session('b', T + 1) }, shared: shared(), shas: {}, dirtyMonths: [MONTH], device: 'tv' }

    const r1 = await syncOnce(client, mac)
    expect(r1.pushedIds).toEqual(['a'])
    const r2 = await syncOnce(client, tv)
    expect(Object.keys(r2.remoteSessions).sort()).toEqual(['a', 'b'])

    // Mac pulls again with its known shas and sees the TV session.
    const r3 = await syncOnce(client, { ...mac, shas: r1.shas, dirtyMonths: [] })
    expect(Object.keys(r3.remoteSessions)).toContain('b')
  })

  it('never overwrites sessions written by the other device', async () => {
    const { client, files } = fakeGitHub()
    await syncOnce(client, { sessions: { a: session('a', T) }, shared: shared(), shas: {}, dirtyMonths: [MONTH], device: 'mac' })
    const r = await syncOnce(client, {
      sessions: { b: session('b', T) },
      shared: shared(),
      shas: { [`sessions/${MONTH}.json`]: 'stale' },
      dirtyMonths: [MONTH],
      device: 'tv',
    })
    expect(r.pushedIds).toEqual(['b'])
    const stored = JSON.parse(files.get(`sessions/${MONTH}.json`)!.content)
    expect(Object.keys(stored.sessions).sort()).toEqual(['a', 'b'])
  })

  it('carries an unfinished lesson to the other device', async () => {
    const { client } = fakeGitHub()
    const ip: SharedState = {
      ...shared(),
      inProgressUpdatedAt: 10,
      inProgress: { id: 'x', startedAt: 1, device: 'mac', units: 1, state: {} as never },
    }
    await syncOnce(client, { sessions: {}, shared: ip, shas: {}, dirtyMonths: [], device: 'mac' })

    const r = await syncOnce(client, { sessions: {}, shared: shared(), shas: {}, dirtyMonths: [], device: 'tv' })
    expect(r.shared.inProgress?.id).toBe('x')

    // TV finishes it; the Mac's older copy must not come back.
    await syncOnce(client, { sessions: {}, shared: { ...shared(), inProgressUpdatedAt: 20 }, shas: {}, dirtyMonths: [], device: 'tv' })
    const back = await syncOnce(client, { sessions: {}, shared: ip, shas: {}, dirtyMonths: [], device: 'mac' })
    expect(back.shared.inProgress).toBeNull()
  })
})
