import { memo } from 'react'
import { msToWpm, shownPercent, shownWpm } from '../engine/typing'
import { useT } from '../i18n'
import type { Progress } from '../lessons/curriculum'

interface KeyDef {
  label: string
  /** Characters this physical key produces that the curriculum cares about. */
  chars: string[]
  shiftLabel?: string
}

const letter = (c: string): KeyDef => ({ label: c.toUpperCase(), chars: [c, c.toUpperCase()] })

const ROWS: KeyDef[][] = [
  [
    { label: '1', chars: ['!'], shiftLabel: '!' },
    ...'2345678'.split('').map((d) => ({ label: d, chars: [] })),
    { label: '9', chars: ['('], shiftLabel: '(' },
    { label: '0', chars: [')'], shiftLabel: ')' },
    { label: '-', chars: ['-'] },
  ],
  'qwertyuiop'.split('').map(letter),
  [
    ...'asdfghjkl'.split('').map(letter),
    { label: ';', chars: [';', ':'], shiftLabel: ':' },
    { label: "'", chars: ["'", '"'], shiftLabel: '"' },
  ],
  [
    ...'zxcvbnm'.split('').map(letter),
    { label: ',', chars: [','] },
    { label: '.', chars: ['.'] },
    { label: '/', chars: ['?'], shiftLabel: '?' },
  ],
]

// Row indents, in key widths, like a real staggered keyboard.
const OFFSETS = [0, 0.5, 0.8, 1.3]

function tooltip(chars: string[], p: Progress, t: ReturnType<typeof useT>): string {
  return chars
    .filter((c) => p.unlocked.has(c))
    .map((c) => {
      const k = p.keys[c]
      if (!k || k.ms === null) return `${c}: ${t.notPracticed}`
      return t.keyTooltip(c, shownWpm(msToWpm(k.ms)), shownPercent(k.acc ?? 0))
    })
    .join('\n')
}

/** Shows which keys are unlocked, which are weak, and the current focus key. No finger hints. */
export const KeyboardMap = memo(function KeyboardMap({ progress }: { progress: Progress }) {
  const t = useT()
  return (
    <div className="flex flex-col gap-1.5 items-start [--k:clamp(1.75rem,5.4vw,2.75rem)]">
      {ROWS.map((row, r) => (
        <div key={r} className="flex gap-1.5" style={{ marginLeft: `calc(var(--k) * ${OFFSETS[r]})` }}>
          {row.map((k) => {
            const open = k.chars.filter((c) => progress.unlocked.has(c))
            const isFocus = progress.focus !== null && k.chars.includes(progress.focus)
            const isWeak = open.some((c) => progress.weak.includes(c))
            let cls = 'bg-slate-100 text-slate-300 border-slate-200'
            if (open.length > 0) cls = 'bg-white text-slate-700 border-slate-300 shadow-sm'
            if (isWeak) cls = 'bg-amber-50 text-amber-700 border-amber-300 shadow-sm'
            if (isFocus) cls = 'bg-theme-500 text-white border-theme-600 shadow ring-4 ring-theme-200'
            return (
              <div
                key={k.label}
                title={tooltip(k.chars, progress, t)}
                className={`relative w-(--k) h-(--k) text-[calc(var(--k)*0.36)] rounded-lg border flex items-center justify-center font-semibold ${cls}`}
              >
                {k.shiftLabel && <span className="absolute top-0.5 left-1.5 text-[10px] opacity-70">{k.shiftLabel}</span>}
                {k.label}
              </div>
            )
          })}
        </div>
      ))}
      <div
        className="mt-0.5 h-[calc(var(--k)*0.8)] w-[calc(var(--k)*6.5)] ml-[calc(var(--k)*2.6)] rounded-lg border border-slate-300 bg-white shadow-sm"
        title={t.space}
      />
    </div>
  )
})
