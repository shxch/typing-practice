import { useT } from '../i18n'
import { hasLocalChanges, useApp } from '../store/app'
import { syncNow } from '../sync/runner'

export function SyncBadge() {
  const status = useApp((s) => s.status)
  const statusMessage = useApp((s) => s.statusMessage)
  const pending = useApp(hasLocalChanges)
  const t = useT()

  const view = {
    unconfigured: { text: t.syncUnconfigured, cls: 'bg-slate-100 text-slate-500' },
    idle: { text: t.syncIdle, cls: 'bg-slate-100 text-slate-500' },
    syncing: { text: t.syncing, cls: 'bg-sky-100 text-sky-700' },
    ok: pending ? { text: t.syncPending, cls: 'bg-amber-100 text-amber-700' } : { text: t.syncOk, cls: 'bg-emerald-100 text-emerald-700' },
    offline: { text: t.syncOffline, cls: 'bg-amber-100 text-amber-700' },
    error: { text: t.syncError, cls: 'bg-rose-100 text-rose-700' },
  }[status]

  return (
    <button
      onClick={() => void syncNow()}
      title={statusMessage || t.syncClick}
      className={`px-3 py-1 rounded-full text-sm font-medium ${view.cls}`}
    >
      {view.text}
    </button>
  )
}
