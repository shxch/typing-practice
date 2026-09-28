import { useMemo } from 'react'
import { msToWpm } from '../engine/typing'
import { useT } from '../i18n'
import { UNITS, meetsTarget, targetMs, type Progress, type Stage, type UnlockSettings } from '../lessons/curriculum'
import { byTime, keySpeedSeries, keySummary } from '../lessons/stats'
import type { Session } from '../store/types'
import { LineChart } from './charts/LineChart'

/** Sequential blue steps, slow -> fast (relative to the target speed). */
const STEPS = [100, 200, 300, 400, 500, 600, 700]

function tileStyle(ratio: number | null) {
  if (ratio === null) return { background: 'white', color: 'var(--viz-axis)' }
  const i = ratio >= 1.25 ? 6 : ratio >= 1 ? 5 : Math.max(0, Math.min(4, Math.floor(((ratio - 0.3) / 0.7) * 5)))
  return { background: `var(--viz-seq-${STEPS[i]})`, color: i >= 3 ? 'white' : 'var(--viz-text)' }
}

interface Props {
  progress: Progress
  sessions: Record<string, Session>
  settings: UnlockSettings & { targetWpm: number }
  selected: string | null
  onSelect: (ch: string) => void
}

/** keybr-style key overview: every key's speed at a glance, plus the chosen key's progress chart. */
export function KeyPanel({ progress, sessions, settings, selected, onSelect }: Props) {
  const t = useT()
  const sorted = useMemo(() => byTime(Object.values(sessions)), [sessions])
  const key = selected && progress.unlocked.has(selected) ? selected : progress.focus
  const stages: Stage[] = (['A', 'B', 'C'] as const).filter((s) => UNITS.some((u, i) => u.stage === s && i < progress.unlockedUnits))
  const stageName = { A: t.stageA, B: t.stageB, C: t.stageC }

  const series = useMemo(() => (key ? keySpeedSeries(sorted, key) : []), [sorted, key])
  const summary = useMemo(() => (key ? keySummary(sorted, key) : null), [sorted, key])
  const fmt = (v: number | null) => (v === null ? '–' : Math.round(v).toString())

  return (
    <div className="@container">
    <div className="grid gap-x-5 gap-y-3 @3xl:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
      <div className="space-y-1.5">
        {stages.map((stage) => (
          <div key={stage}>
            {stages.length > 1 && <div className="text-xs text-slate-500 mb-1">{stageName[stage]}</div>}
            <div className="flex flex-wrap gap-1">
              {UNITS.filter((u) => u.stage === stage)
                .flatMap((u) => u.chars)
                .map((ch) => {
                  const open = progress.unlocked.has(ch)
                  const perf = progress.keys[ch]
                  // Speed relative to this key's own target (keys needing Shift get extra time).
                  const ratio = open && perf?.ms ? targetMs(ch, settings) / perf.ms : null
                  const done = open && meetsTarget(ch, perf, settings)
                  const style = open ? tileStyle(ratio) : { background: 'var(--viz-grid)', color: '#b5b3ad' }
                  return (
                    <button
                      key={ch}
                      disabled={!open}
                      onClick={(e) => {
                        onSelect(ch)
                        e.currentTarget.blur()
                      }}
                      title={
                        open
                          ? perf?.ms
                            ? t.keyTooltip(ch, Math.round(msToWpm(perf.ms)), Math.round((perf.acc ?? 0) * 100))
                            : `${ch}: ${t.notPracticed}`
                          : t.locked
                      }
                      className={`relative w-8 h-9 rounded-md font-mono font-semibold text-base border ${
                        ch === key ? 'ring-2 ring-offset-1 ring-theme-500 border-transparent' : 'border-black/5'
                      } ${ch === progress.focus ? 'underline decoration-2 underline-offset-2' : ''}`}
                      style={style}
                    >
                      {ch}
                      {done && <span className="absolute -top-1.5 -right-1 text-[10px] text-emerald-600 bg-white rounded-full leading-none px-0.5">✓</span>}
                    </button>
                  )
                })}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1 text-xs text-slate-500">
          <span>{t.slow}</span>
          <span className="flex">
            {STEPS.map((s) => (
              <span key={s} className="w-4 h-2.5 first:rounded-l last:rounded-r" style={{ background: `var(--viz-seq-${s})` }} />
            ))}
          </span>
          <span>{t.fast}</span>
          <span className="ml-3 text-emerald-600">✓</span>
          <span>{t.onTarget}</span>
          <span className="ml-3 underline decoration-2 underline-offset-2 font-mono">a</span>
          <span>{t.focusKey}</span>
        </div>
      </div>

      <div className="min-w-0">
        {key && summary && (
          <>
            <div className="flex items-baseline gap-x-3 gap-y-1 flex-wrap">
              <span className="font-mono text-2xl font-bold text-slate-800 w-6">{key === ' ' ? '␣' : key}</span>
              <Stat label={t.recentSpeed} value={`${fmt(summary.recent)} WPM`} />
              <Stat label={t.bestSpeed} value={`${fmt(summary.best)} WPM`} />
              <Stat label={t.accuracy} value={summary.accuracy === null ? '–' : `${Math.round(summary.accuracy * 100)}%`} />
              <Stat label={t.hits} value={String(summary.hits)} />
            </div>
            <div className="text-xs text-slate-500 mt-1">{t.keySpeedChart(key)}</div>
            <LineChart
              points={series}
              target={{ value: settings.targetWpm, label: t.target(settings.targetWpm) }}
              height={90}
              yTicks={2}
              format={(v) => String(Math.round(v))}
              tooltip={(p) => t.lessonPoint(p.lesson, Math.round(p.value))}
              empty={t.noDataYet}
              ariaLabel={t.keySpeedChart(key)}
            />
          </>
        )}
      </div>
    </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-xs text-slate-500">
      {label} <span className="text-sm font-semibold text-slate-800">{value}</span>
    </span>
  )
}
