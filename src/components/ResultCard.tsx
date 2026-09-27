import { msToWpm } from '../engine/typing'
import { useT } from '../i18n'

export interface RoundResult {
  wpm: number
  accuracy: number
  slowest: { ch: string; ms: number }[]
  newKeys: string[]
  stars: 1 | 2 | 3
  goalJustDone: boolean
  streak: number
  levelUp: string | null
}

export function ResultCard({ result, onNext }: { result: RoundResult; onNext: () => void }) {
  const t = useT()
  const show = (ch: string) => (ch === ' ' ? t.space : ch)
  return (
    <div className="rounded-2xl bg-white/85 backdrop-blur shadow-lg p-8 text-center space-y-6">
      <div>
        <div className="flex justify-center gap-3 text-5xl">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={n <= result.stars ? 'animate-[pop_400ms_ease-out_both]' : 'grayscale opacity-25'}
              style={{ animationDelay: `${(n - 1) * 180}ms` }}
            >
              ⭐
            </span>
          ))}
        </div>
        <div className="text-xs text-slate-400 mt-2">{t.starHint}</div>
      </div>
      {result.goalJustDone && (
        <div className="rounded-xl bg-emerald-500 text-white py-3 text-xl font-bold">
          {t.goalJustDone}
          {result.streak > 1 && <div className="text-base font-medium mt-1">{t.goalStreakNote(result.streak)}</div>}
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
