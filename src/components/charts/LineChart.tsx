import { useState } from 'react'
import type { Point } from '../../lessons/stats'
import { niceTicks, useWidth } from './useWidth'

interface Props {
  /** The actual data points, one per round. */
  points: Point[]
  /** Dashed reference line, e.g. the target speed. */
  target?: { value: number; label: string }
  height?: number
  /** Fixed y-axis max (e.g. 100 for percentages); otherwise fits the data. */
  yMax?: number
  /** Roughly how many y gridlines; fewer suits short charts. */
  yTicks?: number
  format: (v: number) => string
  tooltip: (p: Point) => string
  empty: string
  ariaLabel: string
}

const M = { top: 10, right: 12, bottom: 22, left: 34 }

/**
 * Single-series line chart of the actual data points (no smoothing), with a crosshair + tooltip.
 * One series, so no legend: the title names it.
 */
export function LineChart({ points: line, target, height = 160, yMax, yTicks: yCount = 4, format, tooltip, empty, ariaLabel }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  // Keep the measured wrapper the same element whether or not there is data.
  if (line.length === 0) {
    return (
      <div ref={ref} className="relative">
        <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>
          {empty}
        </div>
      </div>
    )
  }

  const pts = line
  const maxX = Math.max(...pts.map((p) => p.lesson), 2)
  const minX = Math.min(...pts.map((p) => p.lesson), 1)
  const dataMax = Math.max(...pts.map((p) => p.value), target?.value ?? 0)
  const yTicks = yMax !== undefined ? niceTicks(yMax, yCount) : niceTicks(dataMax * 1.1, yCount)
  const top = yTicks[yTicks.length - 1]
  const w = width - M.left - M.right
  const h = height - M.top - M.bottom
  const x = (l: number) => M.left + (maxX === minX ? w / 2 : ((l - minX) / (maxX - minX)) * w)
  const y = (v: number) => M.top + h - (Math.min(v, top) / top) * h
  const path = line.map((p, i) => `${i ? 'L' : 'M'}${x(p.lesson).toFixed(1)},${y(p.value).toFixed(1)}`).join('')
  // Rounds are whole numbers: no "round 1.5" tick when there are only a few.
  const xTicks = niceTicks(maxX, 5).filter((v) => v >= minX && v <= maxX && Number.isInteger(v))

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - box.left + M.left
    let best = 0
    line.forEach((p, i) => {
      if (Math.abs(x(p.lesson) - mx) < Math.abs(x(line[best].lesson) - mx)) best = i
    })
    setHover(best)
  }

  const hp = hover !== null ? line[hover] : null

  return (
    <div ref={ref} className="relative">
      <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block">
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} stroke="var(--viz-grid)" strokeWidth={1} />
            <text x={M.left - 6} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--viz-axis)">
              {format(v)}
            </text>
          </g>
        ))}
        {xTicks.map((v) => (
          <text key={v} x={x(v)} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--viz-axis)">
            {v}
          </text>
        ))}
        {target && (
          <g>
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
        <path d={path} fill="none" stroke="var(--viz-series)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {/* A marker on every data point while they're far enough apart to read. */}
        {(line.length === 1 || w / line.length >= 8) &&
          line.map((p) => (
            <circle key={p.lesson} cx={x(p.lesson)} cy={y(p.value)} r={3} fill="var(--viz-series)" stroke="white" strokeWidth={1.5} />
          ))}
        {hp && (
          <g pointerEvents="none">
            <line x1={x(hp.lesson)} x2={x(hp.lesson)} y1={M.top} y2={M.top + h} stroke="var(--viz-ref)" strokeWidth={1} />
            <circle cx={x(hp.lesson)} cy={y(hp.value)} r={4.5} fill="var(--viz-series)" stroke="white" strokeWidth={2} />
          </g>
        )}
        <rect
          x={M.left}
          y={M.top}
          width={w}
          height={h}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>
      {hp && (
        <div
          className="absolute pointer-events-none -translate-x-1/2 -translate-y-full rounded-md bg-slate-900/90 text-white text-xs px-2 py-1 whitespace-nowrap"
          style={{ left: Math.min(Math.max(x(hp.lesson), 70), width - 70), top: y(hp.value) - 8 }}
        >
          {tooltip(hp)}
        </div>
      )}
    </div>
  )
}
