import { useLayoutEffect, useRef, useState } from 'react'
import type { TypingState } from '../engine/typing'

const MARK_CLASS = {
  ok: 'text-slate-800',
  fixed: 'text-amber-500',
  err: 'text-white bg-rose-500 rounded-sm',
  pending: 'text-slate-400',
} as const

interface Caret {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Renders the lesson text; words never break across lines.
 * The caret is one element that glides to the next character (CSS transition) instead of
 * jumping, which is much easier on the eyes when typing fast.
 */
export function TypingArea({ state, large = false }: { state: TypingState; large?: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [caret, setCaret] = useState<Caret | null>(null)
  const [animate, setAnimate] = useState(false)
  const textRef = useRef(state.text)

  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    const place = () => {
      const el = box.querySelector<HTMLElement>(`[data-i="${state.pos}"]`)
      if (!el) return setCaret(null)
      setCaret({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight })
    }
    // A new lesson (or a resize reflow) should snap, not slide across the screen.
    const newText = textRef.current !== state.text
    textRef.current = state.text
    setAnimate(!newText)
    place()
    const ro = new ResizeObserver(() => {
      setAnimate(false)
      place()
    })
    ro.observe(box)
    return () => ro.disconnect()
  }, [state.pos, state.text, large])

  const words: { start: number; text: string }[] = []
  let start = 0
  for (const part of state.text.split(/(?<= )/)) {
    words.push({ start, text: part })
    start += part.length
  }
  const missedHere = state.missed[state.pos]

  return (
    <div
      ref={boxRef}
      className={`relative font-mono tracking-wide select-none ${large ? 'text-4xl leading-[2]' : 'text-3xl leading-[1.9]'}`}
    >
      {caret && !state.done && (
        <div
          aria-hidden
          className="absolute left-0 top-0 pointer-events-none"
          style={{
            width: caret.w,
            height: caret.h,
            transform: `translate(${caret.x}px, ${caret.y}px)`,
            transition: animate ? 'transform 110ms cubic-bezier(0.25, 0.8, 0.35, 1), width 110ms' : 'none',
          }}
        >
          <div
            className={`absolute inset-x-0 top-[12%] bottom-[12%] rounded-md transition-colors duration-150 ${
              missedHere ? 'bg-rose-200' : 'bg-violet-200'
            }`}
          />
          <div
            className={`absolute inset-x-0 bottom-[8%] h-1 rounded-full transition-colors duration-150 ${
              missedHere ? 'bg-rose-500' : 'bg-violet-500'
            }`}
          />
        </div>
      )}
      {words.map((w) => (
        <span key={w.start} className="inline-block whitespace-pre">
          {[...w.text].map((ch, j) => {
            const i = w.start + j
            const mark = state.marks[i]
            let cls: string = MARK_CLASS[mark]
            if (i === state.pos && !state.done) cls = missedHere ? 'text-rose-700' : 'text-violet-900'
            const shown = mark === 'err' && ch === ' ' ? '·' : ch
            return (
              <span key={i} data-i={i} className={`relative ${cls}`}>
                {shown}
              </span>
            )
          })}
        </span>
      ))}
    </div>
  )
}
