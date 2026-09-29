import { useMemo } from 'react'
import { useT } from '../i18n'
import { computeProgress } from '../lessons/curriculum'
import { computeBadges } from '../rewards/badges'
import { BadgeIcon } from './BadgeIcon'
import { dayKey } from '../lessons/stats'
import { levelOf, minutesOn, streak, totalStars } from '../rewards/rewards'
import type { Session, SyncedSettings } from '../store/types'

interface Props {
  sessions: Session[]
  settings: SyncedSettings
  /** Time spent in the round being typed right now, so the bar moves while typing. */
  liveMs: number
  /** Open the badge wall. */
  onOpenBadges?: () => void
}

/** Today's goal, streak and level — the reasons to come back tomorrow. */
export function DailyBar({ sessions, settings, liveMs, onOpenBadges }: Props) {
  const t = useT()
  const goal = settings.dailyGoalMinutes
  const today = minutesOn(sessions, dayKey(Date.now())) + liveMs / 60000
  const done = today >= goal
  const days = streak(sessions, goal)
  const stars = totalStars(sessions, settings)
  const lv = levelOf(stars)
  const name = t.levels[Math.min(lv.level, t.levels.length - 1)]
  const lang = settings.lang
  const states = useMemo(
    () => computeBadges(sessions, settings, computeProgress(sessions, settings).earnedUnits),
    [sessions, settings],
  )
  const earned = states.filter((s) => s.earnedAt !== null)
  const latest = earned.reduce<(typeof earned)[number] | null>((a, b) => (a && a.earnedAt! >= b.earnedAt! ? a : b), null)
  const levelShare = lv.next === null ? 1 : (stars - lv.current) / (lv.next - lv.current)

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
      <div className="flex-[2] min-w-64">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-semibold text-slate-800">{t.todayGoal}</span>
          <span className="text-sm text-slate-600">
            {t.minutesProgress(Math.floor(today), goal)}
            <span className="mx-1.5 text-slate-300">·</span>
            <span className={done ? 'text-emerald-600 font-semibold' : ''}>
              {done ? t.goalDone : t.goalLeft(Math.max(1, Math.ceil(goal - today)))}
            </span>
          </span>
        </div>
        <div className="h-3.5 rounded-full bg-[var(--viz-grid)] mt-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full ${done ? 'bg-emerald-500' : 'bg-gradient-to-r from-theme-400 to-theme-600'}`}
            style={{ width: `${Math.min(1, today / goal) * 100}%`, transition: 'width 600ms ease' }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-3xl ${days > 0 ? '' : 'grayscale opacity-40'}`}>🔥</span>
        <div className="font-semibold text-slate-800">{days > 0 ? t.streakDays(days) : t.streakNone}</div>
      </div>

      <button
        type="button"
        onClick={(e) => {
          onOpenBadges?.()
          e.currentTarget.blur()
        }}
        title={t.levelOpenBadges}
        className="flex items-center gap-3 min-w-56 flex-1 text-left rounded-xl hover:bg-theme-50 -m-1.5 p-1.5"
      >
        {latest ? <BadgeIcon badge={latest.badge} size={52} /> : <span className="text-3xl w-[52px] text-center">⭐</span>}
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-slate-800">
              {t.level(lv.level)} {name}
            </span>
            <span className="text-sm text-slate-500">⭐ {stars}</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--viz-grid)] mt-1 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500"
              style={{ width: `${levelShare * 100}%`, transition: 'width 600ms ease' }}
            />
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{lv.next === null ? t.maxLevel : t.starsToNext(lv.next - stars)}</div>
          <div className="text-xs text-slate-500">
            {latest ? t.latestBadge(latest.badge.name[lang], earned.length, states.length) : t.noBadgeYet}
          </div>
        </div>
      </button>
    </div>
  )
}
