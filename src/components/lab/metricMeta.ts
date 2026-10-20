// Shared presentation helpers for experiment metrics — keeps formatting and
// labels consistent between the metric chips, arm cards, and the distribution
// chart. The engine (src/lab/experiment.ts) owns the math; this owns the words.

import type { MetricId } from '../../lab/experiment'

export interface MetricMeta {
  id: MetricId
  /** Full label for headings and chips. */
  label: string
  /** Short label for tight segmented controls. */
  short: string
  /** One-line description of what the metric measures. */
  blurb: string
  /** Whether a lower value is the desired direction. */
  betterIsLower: boolean
  /** Format a raw outcome/mean value for display. */
  format: (v: number) => string
  /** Axis-friendly numeric value (points or percent). */
  toAxis: (v: number) => number
  /** Unit suffix for chart axes / tooltips. */
  unit: string
}

const signed = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`

export const METRICS: Record<MetricId, MetricMeta> = {
  risk_change: {
    id: 'risk_change',
    label: 'Risk change',
    short: 'Risk change',
    blurb: 'Mean change in the 0–100 risk score over ~30 days. Negative is a reduction.',
    betterIsLower: true,
    format: (v) => `${signed(v)} pts`,
    toAxis: (v) => Math.round(v * 10) / 10,
    unit: ' pts',
  },
  harm_averted: {
    id: 'harm_averted',
    label: 'Harm averted',
    short: 'Harm averted',
    blurb: 'Reduction in modelled probability of gambling-related harm at the horizon.',
    betterIsLower: false,
    format: (v) => `${v >= 0 ? '' : '−'}${Math.abs(v * 100).toFixed(1)}%`,
    toAxis: (v) => Math.round(v * 1000) / 10,
    unit: '%',
  },
  crossed_below_high: {
    id: 'crossed_below_high',
    label: 'Crossed below High',
    short: 'Below High',
    blurb: 'Share of High-risk players who fall below the High threshold (score < 60).',
    betterIsLower: false,
    format: (v) => `${Math.round(v * 100)}%`,
    toAxis: (v) => Math.round(v * 1000) / 10,
    unit: '%',
  },
}

export function metricMeta(id: MetricId): MetricMeta {
  return METRICS[id]
}
