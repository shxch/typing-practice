import { useEffect, useState } from 'react'
import { SyncBadge } from './components/SyncBadge'
import { Practice } from './pages/Practice'
import { Settings } from './pages/Settings'
import { hasLocalChanges, useApp } from './store/app'
import { syncNow } from './sync/runner'

type Page = 'practice' | 'settings'

/** Keep this device and the data repo in step: on open, on focus/blur, when back online, and periodically. */
function useAutoSync() {
  useEffect(() => {
    void syncNow()
    const onVisibility = () => void syncNow()
    const onOnline = () => void syncNow()
    const timer = window.setInterval(() => {
      if (hasLocalChanges(useApp.getState())) void syncNow()
    }, 30_000)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
      window.clearInterval(timer)
    }
  }, [])
}

export default function App() {
  const [page, setPage] = useState<Page>('practice')
  useAutoSync()

  const tab = (p: Page, label: string) => (
    <button
      onClick={(e) => {
        setPage(p)
        // Don't let a later space/enter re-trigger the tab button.
        e.currentTarget.blur()
      }}
      className={`px-4 py-1.5 rounded-lg font-medium ${page === p ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-violet-100'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-sky-50">
      <header className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
        <h1 className="text-2xl font-extrabold text-violet-700">⌨️ 打字小达人</h1>
        <nav className="flex items-center gap-2">
          {tab('practice', '练习')}
          {tab('settings', '设置')}
          <span className="w-3" />
          <SyncBadge />
        </nav>
      </header>
      <main className="max-w-5xl mx-auto px-6 pb-12">{page === 'practice' ? <Practice /> : <Settings />}</main>
    </div>
  )
}
