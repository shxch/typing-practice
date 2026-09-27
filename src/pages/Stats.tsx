import { useMemo, useState } from 'react'
import { BarChart } from '../components/charts/BarChart'
import { Calendar } from '../components/charts/Calendar'
import { LineChart } from '../components/charts/LineChart'
import { KeyPanel } from '../components/KeyPanel'
import { useT } from '../i18n'
import { UNITS, computeProgress } from '../lessons/curriculum'
import { byTime, dailyTime, dayKey, keySummary, sessionsOnDay, smooth, totals, type Point, type Totals } from '../lessons/stats'
import { useApp } from '../store/app'

function formatTime(ms: number) {
  const m = Math.round(ms / 60000)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

const panel = 'rounded-2xl bg-white/85 backdrop-blur shadow p-5'

/** keybr-style profile page: totals, speed over time, per-key speeds and a practice calendar. */
export function Stats() {
  const t = useT()
  const sessionsMap = useApp((s) => s.sessions)
  const settings = useApp((s) => s.shared.settings)
  const [selected, setSelected] = useState<string | null>(null)
  const [smoothness, setSmoothness] = useState(0.5)

  const sorted = useMemo(() => byTime(Object.values(sessionsMap)), [sessionsMap])
  const progress = useMemo(() => computeProgress(sorted, settings), [sorted, settings])
  const all = useMemo(() => totals(sorted), [sorted])
  const today = useMemo(() => totals(sessionsOnDay(sorted, dayKey(Date.now()))), [sorted])
  const speed: Point[] = sorted.map((s, i) => ({ lesson: i + 1, value: s.wpm }))
  const acc: Point[] = sorted.map((s, i) => ({ lesson: i + 1, value: s.accuracy * 100 }))
  const keys = UNITS.slice(0, progress.unlockedUnits).flatMap((u) => u.chars)
  const bars = keys.map((ch) => ({ label: ch, value: keySummary(sorted, ch).recent }))

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <TotalsCard title={t.allTime} v={all} />
        <TotalsCard title={t.today} v={today} />
      </div>

      <div className={panel}>
        <KeyPanel progress={progress} sessions={sessionsMap} settings={settings} selected={selected} onSelect={setSelected} />
      </div>

      <div className={panel + ' space-y-3'}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-bold text-slate-800">{t.speedOverTime}</h2>
          <label className="flex items-center gap-2 text-sm text-slate-500">
            {t.smoothness}
            <input
              type="range"
              min={0}
              max={0.9}
              step={0.1}
              value={smoothness}
              onChange={(e) => setSmoothness(Number(e.target.value))}
              className="accent-violet-600"
            />
          </label>
        </div>
        <LineChart
          line={smooth(speed, smoothness)}
          raw={speed}
          target={{ value: settings.targetWpm, label: t.target(settings.targetWpm) }}
          height={200}
          format={(v) => String(Math.round(v))}
          tooltip={(p) => t.lessonPoint(p.lesson, Math.round(p.value))}
          empty={t.noDataYet}
          ariaLabel={t.speedOverTime}
        />
        <h2 className="font-bold text-slate-800 pt-2">{t.accOverTime}</h2>
        <LineChart
          line={smooth(acc, smoothness)}
          raw={acc}
          yMax={100}
          height={140}
          format={(v) => String(Math.round(v))}
          tooltip={(p) => t.accPoint(p.lesson, Math.round(p.value))}
          empty={t.noDataYet}
          ariaLabel={t.accOverTime}
        />
        <div className="text-xs text-slate-400">{t.lessonAxis}</div>
      </div>

      <div className={panel + ' space-y-2'}>
        <h2 className="font-bold text-slate-800">{t.keySpeeds}</h2>
        <div className="text-xs text-slate-400">{t.keySpeedsHint}</div>
        <BarChart
          bars={bars}
          target={{ value: settings.targetWpm, label: t.target(settings.targetWpm) }}
          format={(v) => String(Math.round(v))}
          tooltip={(b) => (b.value === null ? `${b.label}: ${t.notPracticed}` : `${b.label}: ${Math.round(b.value)} WPM`)}
          ariaLabel={t.keySpeeds}
          selected={selected ?? progress.focus}
          onSelect={(ch) => {
            setSelected(ch)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />
      </div>

      <div className={panel + ' space-y-3'}>
        <h2 className="font-bold text-slate-800">{t.calendar}</h2>
        <div className="text-xs text-slate-400">{t.calendarHint(settings.dailyGoalMinutes)}</div>
        <Calendar
          daily={dailyTime(sorted)}
          goalMinutes={settings.dailyGoalMinutes}
          weekdays={t.weekdays}
          monthLabel={t.monthLabel}
          tooltip={(d, m) => t.dayTooltip(d, Math.round(m))}
        />
      </div>
    </div>
  )
}

function TotalsCard({ title, v }: { title: string; v: Totals }) {
  const t = useT()
  const f = (n: number | null, pct = false) => (n === null ? '–' : pct ? `${Math.round(n * 100)}%` : `${Math.round(n)}`)
  const cells: [string, string][] = [
    [t.timeLabel, formatTime(v.timeMs)],
    [t.lessonsLabel, String(v.lessons)],
    [t.topSpeed, `${f(v.topWpm)} WPM`],
    [t.avgSpeed, `${f(v.avgWpm)} WPM`],
    [t.topAcc, f(v.topAcc, true)],
    [t.avgAcc, f(v.avgAcc, true)],
  ]
  return (
    <div className={panel}>
      <h2 className="font-bold text-slate-800 mb-3">{title}</h2>
      <div className="grid grid-cols-3 gap-3">
        {cells.map(([label, value]) => (
          <div key={label}>
            <div className="text-xs text-slate-500">{label}</div>
            <div className="text-xl font-bold text-slate-800">{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
