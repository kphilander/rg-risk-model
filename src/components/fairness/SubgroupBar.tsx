import { pct } from '../../lib/fairness'

/** A single horizontal subgroup bar row (flag rate or recall), matching the
 *  Overview "top risk drivers" bar-row aesthetic: label, right-aligned value,
 *  and a track+fill underneath. Highlights an optional min/max extreme. */
export function SubgroupBar({
  label,
  n,
  rate,
  denomLabel,
  color,
  max,
  smallN,
  extreme,
}: {
  label: string
  n: number
  rate: number
  /** Optional secondary count shown under the label, e.g. "12 flagged". */
  denomLabel?: string
  color: string
  /** Rate used to normalise the bar width (0..1). */
  max: number
  smallN?: boolean
  /** 'high' | 'low' — draws a subtle ring to mark the disparity endpoints. */
  extreme?: 'high' | 'low' | null
}) {
  const width = max > 0 ? Math.min(100, (rate / max) * 100) : 0
  return (
    <div
      className="lift rounded-lg px-3 py-2.5"
      style={{
        background: 'var(--surface-2)',
        boxShadow: extreme ? `inset 0 0 0 1.5px ${color}` : undefined,
      }}
      title={`${label} · n=${n}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-medium truncate">{label}</span>
            {smallN && (
              <span
                className="text-[9px] font-bold rounded px-1 py-px shrink-0"
                style={{ background: 'var(--surface-3)', color: 'var(--text-faint)' }}
                title="Small sample — interpret with caution"
              >
                small n
              </span>
            )}
            {extreme && (
              <span
                className="text-[9px] font-bold rounded px-1 py-px shrink-0"
                style={{ background: `${color}22`, color }}
              >
                {extreme === 'high' ? 'max' : 'min'}
              </span>
            )}
          </div>
          {denomLabel && <div className="text-[11px] text-faint mt-0.5 tabular-nums">{denomLabel}</div>}
        </div>
        <div className="text-right shrink-0">
          <div className="text-[15px] font-semibold tabular-nums" style={{ color }}>
            {pct(rate)}
          </div>
          <div className="text-[10px] text-faint tabular-nums">n={n}</div>
        </div>
      </div>
      <div className="mt-2 ml-5 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
        <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
      </div>
    </div>
  )
}
