import { ArrowDown, ArrowUp } from 'lucide-react'
import type { MetricId } from '../../lab/experiment'
import { metricMeta } from './metricMeta'

/** A labelled chip for an experiment's outcome metric, with a direction arrow
 *  (down = lower is better, up = higher is better). */
export function MetricChip({ metric, title }: { metric: MetricId; title?: string }) {
  const m = metricMeta(metric)
  const Icon = m.betterIsLower ? ArrowDown : ArrowUp
  return (
    <span className="chip" title={title ?? m.blurb}>
      <Icon size={12} strokeWidth={2.5} style={{ color: 'var(--brand)' }} />
      {m.label}
    </span>
  )
}
