import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, ArrowRight } from 'lucide-react'

export function KpiCard({
  label,
  value,
  sub,
  delta,
  deltaGood,
  valueColor,
  to,
  onClick,
}: {
  label: string
  value: ReactNode
  sub?: string
  /** Numeric delta to show as a trend chip. */
  delta?: number
  /** Whether a positive delta is "good" (green) — defaults to false (up = worse). */
  deltaGood?: boolean
  /** Optional semantic colour, shown as a small marker beside the label. */
  valueColor?: string
  /** If set, the whole card becomes a link to this route. */
  to?: string
  /** Runs on click (e.g. to set a filter before navigating). */
  onClick?: () => void
}) {
  const up = (delta ?? 0) >= 0
  const good = deltaGood ? up : !up
  const interactive = !!(to || onClick)

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow inline-flex items-center gap-1.5">
          {valueColor && <span className="h-2 w-2 rounded-[2px] shrink-0" style={{ background: valueColor }} aria-hidden />}
          {label}
        </span>
        {interactive && (
          <ArrowRight
            size={14}
            className="shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            style={{ color: 'var(--accent)' }}
          />
        )}
      </div>
      <div className="mt-2.5 flex items-baseline gap-2">
        <div className="stat-num">{value}</div>
        {delta !== undefined && delta !== 0 && (
          <span
            className="inline-flex items-center gap-0.5 text-[12.5px] font-mono font-medium tabular-nums"
            style={{ color: good ? '#3f8a55' : '#d1432b' }}
          >
            {up ? <ArrowUpRight size={13} strokeWidth={2.25} /> : <ArrowDownRight size={13} strokeWidth={2.25} />}
            {Math.abs(delta)}
          </span>
        )}
      </div>
      {sub && <div className="mt-1.5 text-[12.5px] text-faint">{sub}</div>}
    </>
  )

  // A KPI is a cell: it sits inside a `.kpi-strip` (one ruled panel) or, when
  // used alone, renders as a flat bordered panel.
  const cell = 'block px-5 py-4 text-left'
  const bg = { background: 'var(--surface)' }
  if (to) {
    return (
      <Link to={to} onClick={onClick} className={`${cell} kpi-cell focus-ring group transition-colors hover:!bg-[var(--surface-2)]`} style={bg}>
        {body}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cell} kpi-cell focus-ring group w-full transition-colors hover:!bg-[var(--surface-2)]`} style={bg}>
        {body}
      </button>
    )
  }
  return <div className={`${cell} kpi-cell`} style={bg}>{body}</div>
}
