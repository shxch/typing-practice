import { GitHubClient } from '../../src/sync/github'

const enc = (s: string) => {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}
const dec = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))

/** GitHub's Contents API won't inline files bigger than this. */
export const INLINE_LIMIT = 1024 * 1024

/**
 * In-memory fake of the GitHub Contents API: sha checks on PUT/DELETE, directory listings,
 * the raw media type, the >1 MB "encoding: none" behavior, auth failures and network errors.
 */
export function fakeGitHub(opts: { status?: number } = {}) {
  const files = new Map<string, { content: string; sha: string }>()
  const puts = new Map<string, number>()
  let n = 0
  let conflictsLeft = 0
  let offline = false

  const fetchFn = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if (offline) throw new TypeError('Failed to fetch')
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    if (opts.status) return json(opts.status, { message: `status ${opts.status}` })
    const u = String(url)
    if (!u.includes('/contents/')) return json(200, { full_name: 'o/r' })
    const path = u.split('/contents/')[1]
    const method = init?.method ?? 'GET'
    const accept = (init?.headers as Record<string, string> | undefined)?.Accept ?? ''

    if (method === 'GET') {
      const f = files.get(path)
      if (f) {
        if (accept.includes('raw')) return new Response(f.content, { status: 200 })
        if (f.content.length > INLINE_LIMIT) return json(200, { content: '', encoding: 'none', sha: f.sha })
        return json(200, { content: enc(f.content), encoding: 'base64', sha: f.sha })
      }
      const dir = [...files.keys()].filter((k) => k.startsWith(path + '/'))
      if (dir.length === 0) return json(404, { message: 'Not Found' })
      return json(
        200,
        dir.map((k) => ({ name: k.split('/').pop(), path: k, sha: files.get(k)!.sha, type: 'file' })),
      )
    }

    const body = JSON.parse(String(init!.body))
    const existing = files.get(path)
    if (method === 'DELETE') {
      if (!existing || body.sha !== existing.sha) return json(409, { message: 'sha mismatch' })
      files.delete(path)
      return json(200, {})
    }
    if (conflictsLeft > 0) {
      conflictsLeft--
      return json(409, { message: 'injected conflict' })
    }
    if (existing && body.sha !== existing.sha) return json(409, { message: 'sha mismatch' })
    if (!existing && body.sha) return json(422, { message: 'sha given for new file' })
    if (existing && !body.sha) return json(422, { message: 'sha missing' })
    const sha = `sha${++n}`
    files.set(path, { content: dec(body.content), sha })
    puts.set(path, (puts.get(path) ?? 0) + 1)
    return json(200, { content: { sha } })
  }

  return {
    files,
    puts,
    fetchFn: fetchFn as typeof fetch,
    client: new GitHubClient({ owner: 'o', repo: 'r', token: 't' }, fetchFn as typeof fetch),
    totalPuts: () => [...puts.values()].reduce((a, b) => a + b, 0),
    injectConflicts: (k: number) => (conflictsLeft = k),
    setOffline: (v: boolean) => (offline = v),
    /** Write a file directly, as if another device had pushed it. */
    write: (path: string, data: unknown) => files.set(path, { content: JSON.stringify(data), sha: `sha${++n}` }),
    read: <T>(path: string) => JSON.parse(files.get(path)!.content) as T,
  }
}
