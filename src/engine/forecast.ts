// Risk trajectory forecasting — models each player's risk *velocity* from their
// rolling trend and projects where they're heading. Surfaces low-but-accelerating
// players before harm manifests (an early-warning signal a static score misses).
//
// Basis note: the trend and velocity are DATA-derived (the staff-observation
// overlay is a point-in-time adjustment, not a trended series), so projections
// extend the data-derived score for a coherent trajectory — not the combined one.

import type { RiskAssessment, RiskBand } from '../types'
import { bandForScore } from '../lib/riskBands'

export type Trajectory = 'surging' | 'rising' | 'stable' | 'improving'

export interface Forecast {
  /** Change in risk score per week (least-squares slope over recent points). */
  velocityPerWeek: number
  current: number
  projected30: number
  projected60: number
  band30: RiskBand
  band60: RiskBand
  trajectory: Trajectory
  /** Currently below High but projected to reach High/Critical within 60 days. */
  earlyWarning: boolean
}

/** Least-squares slope of y over integer index 0..n-1. */
function slope(y: number[]): number {
  const n = y.length
  if (n < 2) return 0
  const xm = (n - 1) / 2
  const ym = y.reduce((s, v) => s + v, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (i - xm) * (y[i] - ym)
    den += (i - xm) ** 2
  }
  return den === 0 ? 0 : num / den
}

function trajectoryOf(v: number): Trajectory {
  if (v >= 3) return 'surging'
  if (v >= 0.8) return 'rising'
  if (v <= -0.8) return 'improving'
  return 'stable'
}

// Trend points are spaced ~1 week apart (92-day window / 13 points ≈ 7 days).
export function forecast(a: RiskAssessment): Forecast {
  const pts = a.trend.map((t) => t.score)
  const recent = pts.slice(-6)
  const vPerPoint = slope(recent) // ≈ per week
  // Project from the data-derived score so current + slope share one basis.
  const current = a.dataScore ?? a.score
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
  const projected30 = clamp(current + vPerPoint * 4.3)
  const projected60 = clamp(current + vPerPoint * 8.6)
  const band60 = bandForScore(projected60)
  return {
    velocityPerWeek: Math.round(vPerPoint * 10) / 10,
    current,
    projected30,
    projected60,
    band30: bandForScore(projected30),
    band60,
    trajectory: trajectoryOf(vPerPoint),
    earlyWarning: current < 60 && projected60 >= 60,
  }
}

/** A dated forecast line extending past the window, for the trend chart. */
export function forecastSeries(
  a: RiskAssessment,
  weeks = 8,
): { week: number; score: number }[] {
  const f = forecast(a)
  const out: { week: number; score: number }[] = []
  for (let w = 0; w <= weeks; w++) {
    out.push({ week: w, score: Math.max(0, Math.min(100, Math.round((a.dataScore ?? a.score) + f.velocityPerWeek * w))) })
  }
  return out
}
