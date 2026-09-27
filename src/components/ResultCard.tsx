import { msToWpm } from '../engine/typing'

export interface RoundResult {
  wpm: number
  accuracy: number
  slowest: { ch: string; ms: number }[]
  newKeys: string[]
}

const show = (ch: string) => (ch === ' ' ? '空格' : ch)

export function ResultCard({ result, onNext }: { result: RoundResult; onNext: () => void }) {
  return (
    <div className="rounded-2xl bg-white shadow-lg p-8 text-center space-y-6">
      {result.newKeys.length > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white py-4 text-2xl font-bold">
          🎉 解锁新按键：{result.newKeys.map(show).join(' ')}
        </div>
      )}
      <div className="flex justify-center gap-12">
        <div>
          <div className="text-5xl font-bold text-violet-600">{Math.round(result.wpm)}</div>
          <div className="text-slate-500 mt-1">速度 (WPM)</div>
        </div>
        <div>
          <div className="text-5xl font-bold text-emerald-600">{Math.round(result.accuracy * 100)}%</div>
          <div className="text-slate-500 mt-1">准确率</div>
        </div>
      </div>
      {result.slowest.length > 0 && (
        <div className="text-slate-600">
          最慢的键：
          {result.slowest.map((k) => (
            <span key={k.ch} className="inline-block mx-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 font-mono">
              {show(k.ch)} <span className="text-xs text-amber-700">{Math.round(msToWpm(k.ms))} WPM</span>
            </span>
          ))}
        </div>
      )}
      <button
        onClick={onNext}
        className="px-8 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-lg font-semibold"
      >
        下一轮（按回车）
      </button>
    </div>
  )
}
