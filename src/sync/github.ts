// Minimal GitHub Contents API client for the private data repo.

export interface RepoConfig {
  owner: string
  repo: string
  token: string
}

export interface RemoteFile<T> {
  data: T
  sha: string
}

export interface DirEntry {
  name: string
  path: string
  sha: string
  type: string
}

export class GitHubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

/** 409/422 on PUT means our sha is stale: someone else wrote the file first. */
export const isConflict = (e: unknown) => e instanceof GitHubError && (e.status === 409 || e.status === 422)

type Fetch = typeof fetch

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export class GitHubClient {
  constructor(
    private cfg: RepoConfig,
    private fetchFn: Fetch = (...args) => fetch(...args),
  ) {}

  private url(path: string) {
    const { owner, repo } = this.cfg
    return `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const res = await this.fetchFn(this.url(path), {
      ...init,
      // GitHub caches GETs for 60s; we always want the latest data.
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.cfg.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
    if (!res.ok && res.status !== 404) {
      let msg = res.statusText
      try {
        msg = (await res.json()).message ?? msg
      } catch {
        /* keep statusText */
      }
      throw new GitHubError(res.status, msg)
    }
    return res
  }

  /** Returns null when the file does not exist yet. */
  async getJson<T>(path: string): Promise<RemoteFile<T> | null> {
    const res = await this.request(path)
    if (res.status === 404) return null
    const body = await res.json()
    return { data: JSON.parse(fromBase64(body.content)) as T, sha: body.sha }
  }

  /** Returns an empty list when the directory does not exist yet. */
  async listDir(path: string): Promise<DirEntry[]> {
    const res = await this.request(path)
    if (res.status === 404) return []
    const body = await res.json()
    return Array.isArray(body) ? body : []
  }

  /** Create or update a file. Pass the sha you last saw (null for a new file). Returns the new sha. */
  async putJson(path: string, data: unknown, sha: string | null, message: string): Promise<string> {
    const res = await this.request(path, {
      method: 'PUT',
      body: JSON.stringify({
        message,
        content: toBase64(JSON.stringify(data, null, 1)),
        ...(sha ? { sha } : {}),
      }),
    })
    if (res.status === 404) throw new GitHubError(404, '找不到数据仓库，请检查用户名、仓库名和 token 权限')
    const body = await res.json()
    return body.content.sha
  }

  /** Cheap call to verify the token can see the repo. */
  async check(): Promise<void> {
    const { owner, repo } = this.cfg
    const res = await this.fetchFn(`https://api.github.com/repos/${owner}/${repo}`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${this.cfg.token}`, Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) throw new GitHubError(res.status, res.status === 404 ? '找不到仓库或 token 无权访问' : res.statusText)
  }
}
