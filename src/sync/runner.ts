// Connects syncOnce to the store: one sync at a time, triggered by app events.

import { t } from '../i18n'
import { isConfigured, useApp } from '../store/app'
import { GitHubClient, GitHubError } from './github'
import { mergeSessions, mergeShared, monthOf } from './merge'
import { syncOnce } from './syncer'
import { flushWallpaperOps } from '../wallpapers/custom'

let running: Promise<void> | null = null
let again = false

/** Run a sync now; if one is already running, run another right after it. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    try {
      do {
        again = false
        await runOnce()
      } while (again)
    } finally {
      running = null
    }
  })()
  return running
}

async function runOnce() {
  const st = useApp.getState()
  if (!isConfigured(st.config)) {
    useApp.setState({ status: 'unconfigured', statusMessage: '' })
    return
  }
  useApp.setState({ status: 'syncing', statusMessage: '' })
  try {
    const client = new GitHubClient(st.config)
    const result = await syncOnce(client, {
      sessions: st.sessions,
      shared: st.shared,
      shas: st.shas,
      dirtyMonths: st.dirtyMonths,
      device: st.config.device,
    })

    // Merge into the *current* state: the user may have kept typing while we synced.
    useApp.setState((cur) => {
      // Keep the same object when the remote had nothing new, so nothing is recomputed or saved again.
      const added = Object.keys(result.remoteSessions).some((id) => !(id in cur.sessions))
      const sessions = added ? mergeSessions(result.remoteSessions, cur.sessions) : cur.sessions
      // Still dirty: months added while we synced, plus months of sessions finished meanwhile.
      // (Everything else that was dirty has just been pushed.)
      const synced = new Set(st.dirtyMonths)
      const dirtyMonths = Array.from(
        new Set([
          ...cur.dirtyMonths.filter((m) => !synced.has(m)),
          ...Object.values(cur.sessions)
            .filter((s) => !(s.id in st.sessions) && !(s.id in result.remoteSessions))
            .map((s) => monthOf(s.startedAt)),
        ]),
      )
      return {
        sessions,
        shared: mergeShared(cur.shared, result.shared),
        shas: result.shas,
        dirtyMonths,
        remoteStamp: {
          settings: result.shared.settingsUpdatedAt,
          inProgress: result.shared.inProgressUpdatedAt,
        },
        status: 'ok',
        statusMessage: '',
        lastSyncedAt: Date.now(),
      }
    })
    await flushWallpaperOps(client)
  } catch (e) {
    // fetch() rejects with a TypeError when the network is down; anything else is a real error.
    if (e instanceof TypeError) useApp.setState({ status: 'offline', statusMessage: t().errOffline })
    else useApp.setState({ status: 'error', statusMessage: describeError(e) })
  }
}

/** A sync or connection error in the current language. */
export function describeError(e: unknown): string {
  const d = t()
  if (e instanceof GitHubError) {
    if (e.status === 401) return d.errTokenInvalid
    if (e.status === 403) return d.errTokenNoWrite
    if (e.status === 404) return d.errRepoNotFound
    return d.errGitHub(e.message)
  }
  return d.errGitHub(e instanceof Error ? e.message : String(e))
}
