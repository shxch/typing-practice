import type { Session, SharedState } from '../store/types'

/** Sessions are immutable and keyed by id, so merging is a plain union. */
export function mergeSessions(a: Record<string, Session>, b: Record<string, Session>): Record<string, Session> {
  return { ...a, ...b }
}

/** Last-writer-wins, field group by field group. */
export function mergeShared(local: SharedState, remote: SharedState): SharedState {
  const settingsFromRemote = remote.settingsUpdatedAt > local.settingsUpdatedAt
  const progressFromRemote = remote.inProgressUpdatedAt > local.inProgressUpdatedAt
  return {
    settings: settingsFromRemote ? remote.settings : local.settings,
    settingsUpdatedAt: Math.max(local.settingsUpdatedAt, remote.settingsUpdatedAt),
    inProgress: progressFromRemote ? remote.inProgress : local.inProgress,
    inProgressUpdatedAt: Math.max(local.inProgressUpdatedAt, remote.inProgressUpdatedAt),
  }
}

/** Month bucket a session is stored in, e.g. "2026-09". */
export function monthOf(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const sessionPath = (month: string) => `sessions/${month}.json`
export const STATE_PATH = 'state.json'

export function sessionsInMonth(all: Record<string, Session>, month: string): Record<string, Session> {
  const out: Record<string, Session> = {}
  for (const s of Object.values(all)) if (monthOf(s.startedAt) === month) out[s.id] = s
  return out
}
