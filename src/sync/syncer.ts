// Pull-then-push sync between this device and the private data repo.
//
// Layout of the data repo:
//   sessions/YYYY-MM.json   { sessions: Record<id, Session> }   — append-only, merged by union
//   state.json              SharedState                         — last-writer-wins per field group

import type { Session, SharedState } from '../store/types'
import { GitHubClient, isConflict } from './github'
import { STATE_PATH, mergeSessions, mergeShared, sessionPath, sessionsInMonth } from './merge'

interface MonthFile {
  sessions: Record<string, Session>
}

export interface SyncInput {
  sessions: Record<string, Session>
  shared: SharedState
  shas: Record<string, string>
  dirtyMonths: string[]
  device: string
}

export interface SyncResult {
  /** Sessions seen on the remote (to union into local). */
  remoteSessions: Record<string, Session>
  /** Shared state after merging and pushing (to merge into local). */
  shared: SharedState
  shas: Record<string, string>
  /** Session ids that are now safely on the remote. */
  pushedIds: string[]
}

const MAX_ATTEMPTS = 4

export async function syncOnce(client: GitHubClient, input: SyncInput): Promise<SyncResult> {
  const shas = { ...input.shas }
  let remoteSessions: Record<string, Session> = {}

  // 1. Pull session files that changed since we last saw them.
  for (const entry of await client.listDir('sessions')) {
    if (entry.type !== 'file' || !entry.name.endsWith('.json')) continue
    if (shas[entry.path] === entry.sha) continue
    const file = await client.getJson<MonthFile>(entry.path)
    if (!file) continue
    remoteSessions = mergeSessions(remoteSessions, file.data.sessions ?? {})
    shas[entry.path] = file.sha
  }

  // 2. Push months that have local-only sessions.
  const pushedIds: string[] = []
  for (const month of input.dirtyMonths) {
    const path = sessionPath(month)
    const local = sessionsInMonth(input.sessions, month)
    await withRetry(async () => {
      const remote = await client.getJson<MonthFile>(path)
      const merged = mergeSessions(remote?.data.sessions ?? {}, local)
      remoteSessions = mergeSessions(remoteSessions, merged)
      shas[path] = await client.putJson(
        path,
        { sessions: merged },
        remote?.sha ?? null,
        `${input.device}: 练习记录 ${month}`,
      )
    })
    pushedIds.push(...Object.keys(local))
  }

  // 3. Shared state: pull, merge, push if we have something newer.
  let shared = input.shared
  await withRetry(async () => {
    const remote = await client.getJson<SharedState>(STATE_PATH)
    shared = remote ? mergeShared(input.shared, remote.data) : input.shared
    const newer =
      !remote ||
      shared.settingsUpdatedAt > remote.data.settingsUpdatedAt ||
      shared.inProgressUpdatedAt > remote.data.inProgressUpdatedAt
    if (remote) shas[STATE_PATH] = remote.sha
    if (newer) {
      shas[STATE_PATH] = await client.putJson(STATE_PATH, shared, remote?.sha ?? null, `${input.device}: 更新进度`)
    }
  })

  return { remoteSessions, shared, shas, pushedIds }
}

async function withRetry(fn: () => Promise<void>): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (e) {
      if (!isConflict(e) || attempt >= MAX_ATTEMPTS) throw e
    }
  }
}
