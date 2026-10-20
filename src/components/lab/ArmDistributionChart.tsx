import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ExperimentResult } from '../../lab/experiment'
import { useChartColors } from '../../lib/useChartColors'
import { metricMeta } from './metricMeta'

const SUCCESS = '#3f8a55'

// A stable per-arm categorical palette (best arm is always drawn green via colorFor).
const ARM_PALETTE = ['#3e6488', '#7a8fa6', '#f5a623', '#a9b6c3', '#ff6482']

interface Bucket {
  /** Bucket midpoint on the metric's display scale. */
  label: string
  center: number
  [armKey: string]: number | string
}

/** Bucket every arm's per-player outcomes into a shared histogram and draw the
 *  arms as grouped bars so their outcome distributions can be compared. */
export function ArmDistributionChart({ result }: { result: ExperimentResult }) {
  const c = useChartColors()
  const m = metricMeta(result.metric)

  const { buckets, arms } = useMemo(() => {
    const binary = result.metric === 'crossed_below_high'
    const armKeys = result.arms.map((a, i) => ({
      key: `a${i}`,
      label: a.policy.label,
      isBest: a.policy.id === result.bestId,
      color: a.policy.id === result.bestId ? SUCCESS : ARM_PALETTE[i % ARM_PALETTE.length],
    }))

    // Convert all outcomes to the display scale once.
    const scaled = result.arms.map((a) => a.outcomes.map((o) => m.toAxis(o)))

    if (binary) {
      // Two buckets: "No" (0) and "Crossed" (100), as % of each arm.
      const rows: Bucket[] = [
        { label: 'No cross', center: 0 },
        { label: 'Crossed', center: 100 },
      ]
      scaled.forEach((vals, i) => {
        const n = vals.length || 1
        const crossed = vals.filter((v) => v >= 50).length
        rows[0][`a${i}`] = ((n - crossed) / n) * 100
        rows[1][`a${i}`] = (crossed / n) * 100
      })
      return { buckets: rows, arms: armKeys }
    }

    // Continuous: shared bins across the pooled range, ~9 buckets.
    const all = scaled.flat()
    const lo = Math.min(...all, 0)
    const hi = Math.max(...all, 0)
    const span = hi - lo || 1
    const BINS = 9
    const width = span / BINS
    const rows: Bucket[] = Array.from({ length: BINS }, (_, b) => {
      const start = lo + b * width
      const center = start + width / 2
      return {
        label: `${center >= 0 ? '+' : '−'}${Math.abs(center).toFixed(0)}`,
        center,
      }
    })
    scaled.forEach((vals, i) => {
      const n = vals.length || 1
      const counts = new Array(BINS).fill(0)
      for (const v of vals) {
        let b = Math.floor((v - lo) / width)
        if (b < 0) b = 0
        if (b >= BINS) b = BINS - 1
        counts[b]++
      }
      counts.forEach((ct, b) => {
        rows[b][`a${i}`] = (ct / n) * 100
      })
    })
    return { buckets: rows, arms: armKeys }
  }, [result, m])

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {arms.map((a) => (
          <span key={a.key} className="inline-flex items-center gap-1.5 text-[11px] text-faint">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: a.color }} />
            {a.label}
          </span>
        ))}
      </div>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="18%">
            <CartesianGrid stroke={c.grid} strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: c.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              dy={6}
              interval={0}
            />
            <YAxis
              tick={{ fill: c.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={34}
              unit="%"
            />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)', opacity: 0.5 }}
              contentStyle={{
                background: c.tooltipBg,
                border: `1px solid ${c.tooltipBorder}`,
                borderRadius: 12,
                color: c.text,
                fontSize: 12,
                boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              }}
              formatter={(value: number, _name, item) => [
                `${value.toFixed(0)}% of arm`,
                (item as { dataKey?: string })?.dataKey
                  ? arms.find((a) => a.key === (item as { dataKey?: string }).dataKey)?.label
                  : '',
              ]}
              labelFormatter={(label: string) =>
                result.metric === 'crossed_below_high'
                  ? label
                  : `Outcome ≈ ${label}${m.unit}`
              }
            />
            {arms.map((a) => (
              <Bar
                key={a.key}
                dataKey={a.key}
                name={a.label}
                fill={a.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={26}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-soft">
        Each arm's per-player {m.label.toLowerCase()} outcomes, bucketed and shown as a share of the
        arm (%). A distribution shifted toward {m.betterIsLower ? 'the left' : 'the right'} is the
        desired direction.
      </p>
    </div>
  )
}
