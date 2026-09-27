import { useState } from 'react'
import { niceTicks, useWidth } from './useWidth'

export interface Bar {
  label: string
  value: number | null
}

interface Props {
  bars: Bar[]
  target?: { value: number; label: string }
  height?: number
  format: (v: number) => string
  tooltip: (b: Bar) => string
  ariaLabel: string
  selected?: string | null
  onSelect?: (label: string) => void
}

const M = { top: 14, right: 8, bottom: 22, left: 34 }

/** Single-series bar chart (one bar per key) with a dashed target line and per-bar hover. */
export function BarChart({ bars, target, height = 180, format, tooltip, ariaLabel, selected, onSelect }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const max = Math.max(...bars.map((b) => b.value ?? 0), target?.value ?? 0, 1)
  const ticks = niceTicks(max * 1.1)
  const top = ticks[ticks.length - 1]
  const w = width - M.left - M.right
  const h = height - M.top - M.bottom
  const slot = w / Math.max(bars.length, 1)
  const barW = Math.max(3, Math.min(22, slot - 2)) // 2px surface gap between bars
  const y = (v: number) => M.top + h - (Math.min(v, top) / top) * h
  const hb = hover !== null ? bars[hover] : null

  return (
    <div ref={ref} className="relative">
      <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} stroke="var(--viz-grid)" strokeWidth={1} />
            <text x={M.left - 6} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--viz-axis)">
              {format(v)}
            </text>
          </g>
        ))}
        {bars.map((b, i) => {
          const cx = M.left + slot * i + slot / 2
          const bh = b.value ? M.top + h - y(b.value) : 0
          const r = Math.min(4, barW / 2, bh)
          const x0 = cx - barW / 2
          const y0 = M.top + h - bh
          // Rounded top, square base anchored to the baseline.
          const d = bh
            ? `M${x0},${M.top + h}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + barW - r}Q${x0 + barW},${y0} ${x0 + barW},${y0 + r}V${M.top + h}Z`
            : ''
          const isSel = selected === b.label
          return (
            <g key={b.label}>
              {d && <path d={d} fill="var(--viz-series)" opacity={hover === null || hover === i ? 1 : 0.55} />}
              <text
                x={cx}
                y={height - 6}
                textAnchor="middle"
                fontSize={11}
                fontFamily="ui-monospace, monospace"
                fontWeight={isSel ? 700 : 400}
                fill={isSel ? 'var(--viz-text)' : 'var(--viz-axis)'}
              >
                {b.label}
              </text>
              <rect
                x={cx - slot / 2}
                y={M.top}
                width={slot}
                height={h + M.bottom}
                fill="transparent"
                className={onSelect ? 'cursor-pointer' : undefined}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect?.(b.label)}
              />
            </g>
          )
        })}
        {target && (
          <g pointerEvents="none">
            <line
              x1={M.left}
              x2={width - M.right}
              y1={y(target.value)}
              y2={y(target.value)}
              stroke="var(--viz-ref)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
            <text x={width - M.right} y={y(target.value) - 5} textAnchor="end" fontSize={11} fill="var(--viz-axis)">
              {target.label}
            </text>
          </g>
        )}
      </svg>
      {hb && (
        <div
          className="absolute pointer-events-none -translate-x-1/2 -translate-y-full rounded-md bg-slate-900/90 text-white text-xs px-2 py-1 whitespace-nowrap"
          style={{
            left: Math.min(Math.max(M.left + slot * hover! + slot / 2, 70), width - 70),
            top: y(hb.value ?? 0) - 6,
          }}
        >
          {tooltip(hb)}
        </div>
      )}
    </div>
  )
}
