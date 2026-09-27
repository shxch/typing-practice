import { hasLocalChanges, useApp } from '../store/app'
import { syncNow } from '../sync/runner'

export function SyncBadge() {
  const status = useApp((s) => s.status)
  const statusMessage = useApp((s) => s.statusMessage)
  const pending = useApp(hasLocalChanges)

  const view = {
    unconfigured: { text: '未设置同步', cls: 'bg-slate-100 text-slate-500' },
    idle: { text: '准备同步', cls: 'bg-slate-100 text-slate-500' },
    syncing: { text: '同步中…', cls: 'bg-sky-100 text-sky-700' },
    ok: pending ? { text: '有未同步的进度', cls: 'bg-amber-100 text-amber-700' } : { text: '已同步 ✓', cls: 'bg-emerald-100 text-emerald-700' },
    offline: { text: '离线', cls: 'bg-amber-100 text-amber-700' },
    error: { text: '同步出错', cls: 'bg-rose-100 text-rose-700' },
  }[status]

  return (
    <button
      onClick={() => void syncNow()}
      title={statusMessage || '点击立即同步'}
      className={`px-3 py-1 rounded-full text-sm font-medium ${view.cls}`}
    >
      {view.text}
    </button>
  )
}
