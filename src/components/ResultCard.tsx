import { msToWpm } from '../engine/typing'
import { useT } from '../i18n'
import type { Badge } from '../rewards/badges'
import { BadgeIcon } from './BadgeIcon'
import { useApp } from '../store/app'
import type { Stars } from '../rewards/rewards'

export interface RoundResult {
  wpm: number
  accuracy: number
  slowest: { ch: string; ms: number }[]
  newKeys: string[]
  stars: Stars
  goalJustDone: boolean
  streak: number
  levelUp: string | null
  badges: Badge[]
}

export function ResultCard({ result, onNext }: { result: RoundResult; onNext: () => void }) {
  const t = useT()
  const lang = useApp((s) => s.shared.settings.lang)
  const show = (ch: string) => (ch === ' ' ? t.space : ch)
  return (
    <div className="rounded-2xl bg-white/85 backdrop-blur shadow-lg p-8 text-center space-y-6">
      <div>
        <div className="flex justify-center gap-2 text-5xl">
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              className={n <= result.stars ? 'animate-[pop_400ms_ease-out_both]' : 'grayscale opacity-25'}
              style={{ animationDelay: `${(n - 1) * 150}ms` }}
            >
              ⭐
            </span>
          ))}
        </div>
      </div>
      {result.goalJustDone && (
        <div className="rounded-xl bg-emerald-500 text-white py-3 text-xl font-bold">
          {t.goalJustDone}
          {result.streak > 1 && <div className="text-base font-medium mt-1">{t.goalStreakNote(result.streak)}</div>}
        </div>
      )}
      {result.badges.length > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-theme-400 to-theme-600 text-white py-3 px-4">
          <div className="text-lg font-bold mb-2">{t.newBadges}</div>
          <div className="flex flex-wrap justify-center gap-4">
            {result.badges.map((b, i) => (
              <div
                key={b.id}
                tabIndex={0}
                className="group relative flex flex-col items-center gap-1 cursor-help outline-none animate-[pop_400ms_ease-out_both]"
                style={{ animationDelay: `${300 + i * 150}ms` }}
              >
                <BadgeIcon badge={b} size={60} />
                <span className="text-sm font-semibold">{b.name[lang]}</span>
                <div
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-48 -translate-x-1/2 translate-y-1 rounded-xl bg-white px-3 py-2 text-left text-slate-700 shadow-xl ring-1 ring-amber-200 opacity-0 transition duration-150 group-hover:opacity-100 group-hover:translate-y-0 group-focus:opacity-100 group-focus:translate-y-0"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">{t.badgeWhy}</div>
                  <div className="text-sm leading-snug">{b.desc[lang]}</div>
                  <span className="absolute left-1/2 top-full -translate-x-1/2 border-[6px] border-transparent border-t-white" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {result.levelUp && (
        <div className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white py-3 text-xl font-bold">
          {t.levelUp(result.levelUp)}
        </div>
      )}
      {result.newKeys.length > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-theme-500 to-theme-700 text-white py-4 text-2xl font-bold">
          {t.unlockedNew}{result.newKeys.map(show).join(' ')}
        </div>
      )}
      <div className="flex justify-center gap-12">
        <div>
          <div className="text-5xl font-bold text-theme-600">{Math.round(result.wpm)}</div>
          <div className="text-slate-500 mt-1">{t.speed}</div>
        </div>
        <div>
          <div className="text-5xl font-bold text-emerald-600">{Math.round(result.accuracy * 100)}%</div>
          <div className="text-slate-500 mt-1">{t.accuracy}</div>
        </div>
      </div>
      {result.slowest.length > 0 && (
        <div className="text-slate-600">
          {t.slowestKeys}
          {result.slowest.map((k) => (
            <span key={k.ch} className="inline-block mx-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 font-mono">
              {show(k.ch)} <span className="text-xs text-amber-700">{Math.round(msToWpm(k.ms))} WPM</span>
            </span>
          ))}
        </div>
      )}
      <button
        onClick={onNext}
        className="px-8 py-3 rounded-xl bg-theme-600 hover:bg-theme-700 text-white text-lg font-semibold"
      >
        {t.nextRound}
      </button>
    </div>
  )
}
