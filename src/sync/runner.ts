// Connects syncOnce to the store: one sync at a time, triggered by app events.

import { isConfigured, useApp } from '../store/app'
import { GitHubClient, GitHubError } from './github'
import { mergeSessions, mergeShared, monthOf } from './merge'
import { syncOnce } from './syncer'

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
      const sessions = mergeSessions(result.remoteSessions, cur.sessions)
      const pushed = new Set(result.pushedIds)
      const dirtyMonths = Array.from(
        new Set(
          Object.values(cur.sessions)
            .filter((s) => !pushed.has(s.id) && !(s.id in result.remoteSessions))
            .map((s) => monthOf(s.startedAt)),
        ),
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
  } catch (e) {
    if (e instanceof GitHubError) {
      const msg =
        e.status === 401 ? 'Token 无效或已过期' : e.status === 403 ? 'Token 没有写入权限' : `GitHub 错误：${e.message}`
      useApp.setState({ status: 'error', statusMessage: msg })
    } else {
      useApp.setState({ status: 'offline', statusMessage: '网络不可用，联网后会自动同步' })
    }
  }
}
