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

/** GitHub's explanation of a failed request, or the bare status text. */
async function errorMessage(res: Response): Promise<string> {
  try {
    return (await res.json()).message ?? res.statusText
  } catch {
    return res.statusText
  }
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

  private async request(path: string, init: RequestInit = {}, accept = 'application/vnd.github+json'): Promise<Response> {
    const res = await this.fetchFn(this.url(path), {
      ...init,
      // GitHub caches GETs for 60s; we always want the latest data.
      cache: 'no-store',
      headers: {
        Accept: accept,
        Authorization: `Bearer ${this.cfg.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
    if (!res.ok && res.status !== 404) throw new GitHubError(res.status, await errorMessage(res))
    return res
  }

  /** Returns null when the file does not exist yet. */
  async getJson<T>(path: string): Promise<RemoteFile<T> | null> {
    const res = await this.request(path)
    if (res.status === 404) return null
    const body = await res.json()
    // Files over 1 MB come without inline content; fetch those raw.
    if (body.encoding === 'none' || !body.content) {
      const raw = await this.request(path, {}, 'application/vnd.github.raw+json')
      return { data: JSON.parse(await raw.text()) as T, sha: body.sha }
    }
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

  /** Sha of a file, or null if it doesn't exist. */
  async getSha(path: string): Promise<string | null> {
    const res = await this.request(path)
    if (res.status === 404) return null
    return (await res.json()).sha
  }

  /** Raw file bytes (works for files over 1 MB too), or null if missing. */
  async getBlob(path: string): Promise<Blob | null> {
    const res = await this.request(path, {}, 'application/vnd.github.raw+json')
    if (res.status === 404) return null
    return res.blob()
  }

  /** Create or replace a binary file. */
  async putBlob(path: string, blob: Blob, message: string): Promise<void> {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    const sha = await this.getSha(path)
    await this.request(path, {
      method: 'PUT',
      body: JSON.stringify({ message, content: btoa(bin), ...(sha ? { sha } : {}) }),
    })
  }

  /** Delete a file; missing files are fine. */
  async deleteFile(path: string, message: string): Promise<void> {
    const sha = await this.getSha(path)
    if (!sha) return
    await this.request(path, { method: 'DELETE', body: JSON.stringify({ message, sha }) })
  }

  /** Cheap call to verify the token can see the repo. */
  async check(): Promise<void> {
    const { owner, repo } = this.cfg
    const res = await this.fetchFn(`https://api.github.com/repos/${owner}/${repo}`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${this.cfg.token}`, Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) {
      throw new GitHubError(res.status, res.status === 404 ? '找不到仓库或 token 无权访问' : (await errorMessage(res)) || `HTTP ${res.status}`)
    }
  }
}
