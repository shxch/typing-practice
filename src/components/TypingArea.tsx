import type { TypingState } from '../engine/typing'

const MARK_CLASS = {
  ok: 'text-slate-800',
  fixed: 'text-amber-500',
  err: 'text-white bg-rose-500 rounded-sm',
  pending: 'text-slate-400',
} as const

/** Renders the lesson text; words never break across lines. */
export function TypingArea({ state }: { state: TypingState }) {
  const words: { start: number; text: string }[] = []
  let start = 0
  for (const part of state.text.split(/(?<= )/)) {
    words.push({ start, text: part })
    start += part.length
  }

  return (
    <div className="font-mono text-3xl leading-[1.9] tracking-wide select-none">
      {words.map((w) => (
        <span key={w.start} className="inline-block whitespace-pre">
          {[...w.text].map((ch, j) => {
            const i = w.start + j
            const isCursor = i === state.pos && !state.done
            const mark = state.marks[i]
            let cls: string = MARK_CLASS[mark]
            if (isCursor) {
              cls = state.missed[i]
                ? 'bg-rose-200 text-rose-700 rounded-sm'
                : 'bg-violet-200 text-violet-900 rounded-sm'
            }
            const shown = mark === 'err' && ch === ' ' ? '·' : ch
            return (
              <span key={i} className={`relative ${cls}`}>
                {shown}
                {isCursor && <span className="absolute left-0 right-0 -bottom-1 h-1 rounded bg-violet-500 animate-pulse" />}
              </span>
            )
          })}
        </span>
      ))}
    </div>
  )
}
