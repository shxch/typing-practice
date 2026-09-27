import { useMemo, useRef, useState } from 'react'
import { BadgeIcon } from '../components/BadgeIcon'
import { useT } from '../i18n'
import { computeProgress } from '../lessons/curriculum'
import { computeBadges, type BadgeGroup, type BadgeState } from '../rewards/badges'
import { clearBadgeImage, setBadgeImage, useBadgeImages } from '../wallpapers/custom'
import { syncNow } from '../sync/runner'
import { useApp } from '../store/app'

const GROUPS: BadgeGroup[] = ['rounds', 'speed', 'accuracy', 'streak', 'stars', 'time', 'keys']

/** The badge wall: earned badges in color with their date, the rest greyed with progress. */
export function Badges() {
  const t = useT()
  const lang = useApp((s) => s.shared.settings.lang)
  const sessions = useApp((s) => s.sessions)
  const settings = useApp((s) => s.shared.settings)
  const list = useMemo(() => Object.values(sessions), [sessions])
  const units = useMemo(() => computeProgress(list, settings).unlockedUnits, [list, settings])
  const states = useMemo(() => computeBadges(list, settings, units), [list, settings, units])
  const earnedCount = states.filter((s) => s.earnedAt !== null).length
  const images = useBadgeImages()

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white/85 backdrop-blur shadow px-6 py-5 flex items-center gap-4">
        <span className="text-4xl">🏅</span>
        <div>
          <div className="text-xl font-bold text-slate-800">{t.badgesEarned(earnedCount, states.length)}</div>
          <div className="text-sm text-slate-500">{t.badgesHint}</div>
        </div>
      </div>

      {GROUPS.map((g) => (
        <section key={g} className="rounded-2xl bg-white/85 backdrop-blur shadow p-5">
          <h2 className="font-bold text-slate-800 mb-3">{t.badgeGroups[g]}</h2>
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
            {states
              .filter((s) => s.badge.group === g)
              .map((state) => (
                <BadgeCard key={state.badge.id} state={state} image={images[state.badge.id]} hasImage={state.badge.id in images} lang={lang} />
              ))}
          </div>
        </section>
      ))}
      <p className="text-xs text-slate-500 text-center">{t.badgeImageNote}</p>
    </div>
  )
}

function BadgeCard({ state, image, hasImage, lang }: { state: BadgeState; image: string | null | undefined; hasImage: boolean; lang: 'zh' | 'en' }) {
  const t = useT()
  const { badge, earnedAt, progress } = state
  const got = earnedAt !== null
  const input = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  async function use(files: FileList | null) {
    const file = Array.from(files ?? []).find((f) => f.type.startsWith('image/'))
    if (!file) return
    try {
      await setBadgeImage(badge.id, file)
      void syncNow()
    } catch {
      alert(t.wpAddFailed)
    }
    if (input.current) input.current.value = ''
  }

  return (
    <div
      title={badge.desc[lang]}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        void use(e.dataTransfer.files)
      }}
      className={`group relative rounded-xl border p-3 text-center flex flex-col items-center gap-1 ${
        drag ? 'ring-4 ring-theme-300 ' : ''
      }${got ? 'bg-gradient-to-b from-theme-50 to-white border-theme-200 shadow-sm' : 'bg-slate-50 border-slate-200'}`}
    >
      <BadgeIcon badge={badge} url={image} dim={!got} />
      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
        <button
          onClick={() => input.current?.click()}
          title={t.badgeSetImage}
          className="w-6 h-6 rounded-full bg-white shadow border border-slate-200 text-xs hover:bg-theme-500 hover:text-white"
        >
          🖼️
        </button>
        {hasImage && (
          <button
            onClick={() => {
              clearBadgeImage(badge.id)
              void syncNow()
            }}
            title={t.badgeResetImage}
            className="w-6 h-6 rounded-full bg-white shadow border border-slate-200 text-xs hover:bg-rose-500 hover:text-white"
          >
            ↺
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void use(e.target.files)} />
      <div className={`font-semibold text-sm ${got ? 'text-slate-800' : 'text-slate-400'}`}>{badge.name[lang]}</div>
      <div className="text-[11px] leading-snug text-slate-500">{badge.desc[lang]}</div>
      {got ? (
        <div className="text-[11px] text-theme-700 mt-auto">{new Date(earnedAt).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en')}</div>
      ) : (
        <div className="w-full h-1.5 rounded-full bg-slate-200 mt-auto overflow-hidden">
          <div className="h-full rounded-full bg-theme-400" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </div>
  )
}
