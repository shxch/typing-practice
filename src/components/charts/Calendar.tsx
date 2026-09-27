import { dayKey } from '../../lessons/stats'

interface Props {
  /** Practice ms per local day ("YYYY-MM-DD"). */
  daily: Map<string, number>
  /** Daily goal in minutes; a full cell means the goal was met. */
  goalMinutes: number
  months?: number
  weekdays: string[]
  monthLabel: (year: number, month: number) => string
  tooltip: (day: string, minutes: number) => string
}

const STEPS = ['var(--viz-seq-200)', 'var(--viz-seq-300)', 'var(--viz-seq-400)', 'var(--viz-seq-600)']

/** Month grids; each practiced day is shaded by how much of the daily goal was done (one hue, light -> dark). */
export function Calendar({ daily, goalMinutes, months = 3, weekdays, monthLabel, tooltip }: Props) {
  const now = new Date()
  const list = Array.from({ length: months }, (_, i) => new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1))
  const today = dayKey(Date.now())

  return (
    <div className="flex flex-wrap gap-6">
      {list.map((first) => {
        const year = first.getFullYear()
        const month = first.getMonth()
        const days = new Date(year, month + 1, 0).getDate()
        const lead = (first.getDay() + 6) % 7 // Monday first
        return (
          <div key={`${year}-${month}`}>
            <div className="text-sm font-semibold text-slate-700 mb-1.5">{monthLabel(year, month + 1)}</div>
            <div className="grid grid-cols-7 gap-1 text-[10px] text-slate-400 text-center">
              {weekdays.map((d, i) => (
                <div key={i}>{d}</div>
              ))}
              {Array.from({ length: lead }, (_, i) => (
                <div key={`e${i}`} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const key = dayKey(new Date(year, month, i + 1).getTime())
                const minutes = (daily.get(key) ?? 0) / 60000
                const share = Math.min(1, minutes / goalMinutes)
                const bg = minutes > 0 ? STEPS[Math.min(STEPS.length - 1, Math.floor(share * STEPS.length))] : 'var(--viz-grid)'
                return (
                  <div
                    key={key}
                    title={tooltip(key, minutes)}
                    className={`w-6 h-6 rounded flex items-center justify-center ${key === today ? 'ring-2 ring-theme-500' : ''}`}
                    style={{ background: bg, color: share >= 0.75 ? 'white' : 'var(--viz-axis)' }}
                  >
                    {i + 1}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
