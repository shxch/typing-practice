import { useEffect, useState } from 'react'
import { Background, useWallpaperFit } from './components/Background'
import { SyncBadge } from './components/SyncBadge'
import { findWallpaper } from './content/wallpapers'
import { useT } from './i18n'
import { Practice } from './pages/Practice'
import { Settings } from './pages/Settings'
import { Stats } from './pages/Stats'
import { setVolume } from './sound/sound'
import { hasLocalChanges, useApp } from './store/app'
import { syncNow } from './sync/runner'

type Page = 'practice' | 'stats' | 'settings'

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
  const lang = useApp((s) => s.shared.settings.lang)
  const wallpaperId = useApp((s) => s.shared.settings.wallpaper)
  const sound = useApp((s) => s.config.sound)
  const volume = useApp((s) => s.config.volume)
  const updateSettings = useApp((s) => s.updateSettings)
  const t = useT()
  useAutoSync()

  useEffect(() => setVolume(sound ? volume : 0), [sound, volume])
  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
    document.title = t.appTitle
  }, [lang, t])

  const wallpaper = findWallpaper(wallpaperId)
  const fit = useWallpaperFit(wallpaper)

  // Blur after clicking so a later Space/Enter doesn't re-trigger the button.
  const blurAfter = (fn: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => {
    fn()
    e.currentTarget.blur()
  }

  const tab = (p: Page, label: string) => (
    <button
      onClick={blurAfter(() => setPage(p))}
      className={`px-4 py-1.5 rounded-lg font-medium ${page === p ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-violet-100'}`}
    >
      {label}
    </button>
  )

  return (
    <div
      className="min-h-screen relative isolate"
      // A portrait wallpaper sits on the right; the page moves into the space beside it.
      style={{ marginRight: fit.mode === 'side' ? fit.width : 0 }}
    >
      <Background wallpaper={wallpaper} fit={fit} />
      <div className="max-w-5xl mx-auto px-6 pt-4">
        <header className="flex flex-wrap gap-3 items-center justify-between rounded-2xl bg-white/80 backdrop-blur shadow px-5 py-3">
          <h1 className="text-2xl font-extrabold text-violet-700">⌨️ {t.appTitle}</h1>
          <nav className="flex items-center gap-2">
            {tab('practice', t.navPractice)}
            {tab('stats', t.navStats)}
            {tab('settings', t.navSettings)}
            <button
              onClick={blurAfter(() => updateSettings({ lang: lang === 'zh' ? 'en' : 'zh' }))}
              title={t.langToggleTitle}
              className="w-10 py-1.5 rounded-lg font-semibold text-violet-700 border border-violet-200 hover:bg-violet-100"
            >
              {t.langToggle}
            </button>
            <span className="w-2" />
            <SyncBadge />
          </nav>
        </header>
      </div>
      <main className="max-w-5xl mx-auto px-6 pt-5 pb-12">{page === 'practice' ? <Practice /> : page === 'stats' ? <Stats /> : <Settings />}</main>
    </div>
  )
}
