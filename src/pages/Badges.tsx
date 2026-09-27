import { useMemo } from 'react'
import { useT } from '../i18n'
import { computeProgress } from '../lessons/curriculum'
import { computeBadges, type BadgeGroup } from '../rewards/badges'
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
              .map(({ badge, earnedAt, progress }) => {
                const got = earnedAt !== null
                return (
                  <div
                    key={badge.id}
                    title={badge.desc[lang]}
                    className={`rounded-xl border p-3 text-center flex flex-col items-center gap-1 ${
                      got ? 'bg-gradient-to-b from-theme-50 to-white border-theme-200 shadow-sm' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className={`text-4xl ${got ? '' : 'grayscale opacity-35'}`}>{badge.icon}</div>
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
              })}
          </div>
        </section>
      ))}
    </div>
  )
}
