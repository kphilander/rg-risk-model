// ---------------------------------------------------------------------------
// EXPERIMENT ENGINE — run analyses/experiments on intervention policies.
//
// Declarative: an ExperimentSpec is a cohort (who's in it) + arms (competing
// intervention policies) + a metric. `runExperiment` applies each policy to the
// cohort, simulates the outcome under a synthetic causal model, and returns
// per-arm effect estimates with confidence intervals + a plain-language readout.
//
// This is the substrate operators/researchers extend: define a spec (a few
// lines), register it, and it shows up in the Lab. Fully deterministic (seeded).
// ---------------------------------------------------------------------------

import type { PlayerProfile, RiskAssessment } from '../types'
import { forecast, type Forecast } from '../engine/forecast'
import { makeRng } from '../lib/rng'

export interface Row {
  p: PlayerProfile
  a: RiskAssessment
  f: Forecast
}

/** A policy assigns an escalation level (1–5) to a player, or null = no action. */
export interface Policy {
  id: string
  label: string
  intervene: (row: Row) => number | null
}

export type MetricId = 'risk_change' | 'harm_averted' | 'crossed_below_high'

export interface ExperimentSpec {
  id: string
  name: string
  question: string
  /** Who is eligible for the experiment. */
  cohort: (row: Row) => boolean
  /** Competing policies (include a no-action control for a clean baseline). */
  arms: Policy[]
  metric: MetricId
  seed?: string
}

export interface ArmResult {
  policy: Policy
  n: number
  treated: number
  mean: number
  ci: [number, number]
  /** Per-player outcomes, for distribution charts. */
  outcomes: number[]
}

export interface ExperimentResult {
  spec: ExperimentSpec
  metric: MetricId
  /** Lower risk_change is better; higher harm_averted / crossed_below_high is better. */
  betterIsLower: boolean
  arms: ArmResult[]
  baselineId: string
  bestId: string
  uplift: number
  significant: boolean
  readout: string
}

const HORIZON_WEEKS = 4 // ~30 days
const RESPONSE_PROB: Record<number, number> = { 1: 0.16, 2: 0.32, 3: 0.52, 4: 0.68, 5: 0.81 }

/** Logistic risk→harm-probability mapping (for the harm-averted metric). */
export function harmProb(score: number): number {
  return 1 / (1 + Math.exp(-(score - 70) / 12))
}

/** Simulate a player's end-of-horizon risk under a policy decision. */
function simulateFinalScore(row: Row, level: number | null, rng: ReturnType<typeof makeRng>): number {
  const drift = row.f.velocityPerWeek * HORIZON_WEEKS // natural trajectory if untreated
  let change: number
  if (level == null) {
    change = drift + rng.gauss() * 2
  } else {
    const responded = rng.next() < (RESPONSE_PROB[level] ?? 0.4)
    change = responded
      ? -(6 + level * 3 + Math.abs(rng.gauss()) * 5) + drift * 0.3
      : drift * 0.8 + rng.gauss() * 2
  }
  return Math.max(0, Math.min(100, row.a.score + change))
}

function outcomeValue(metric: MetricId, pre: number, final: number): number {
  switch (metric) {
    case 'risk_change':
      return final - pre
    case 'harm_averted':
      return harmProb(pre) - harmProb(final)
    case 'crossed_below_high':
      return pre >= 60 && final < 60 ? 1 : 0
  }
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0
}
function stddev(xs: number[], m: number): number {
  return xs.length > 1 ? Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)) : 0
}

export function buildRows(players: PlayerProfile[], assessments: Map<string, RiskAssessment>): Row[] {
  return players
    .map((p) => ({ p, a: assessments.get(p.id)! }))
    .filter((x) => x.a)
    .map((x) => ({ ...x, f: forecast(x.a) }))
}

export function runExperiment(
  spec: ExperimentSpec,
  players: PlayerProfile[],
  assessments: Map<string, RiskAssessment>,
): ExperimentResult {
  const rows = buildRows(players, assessments).filter(spec.cohort)
  const betterIsLower = spec.metric === 'risk_change'

  const arms: ArmResult[] = spec.arms.map((policy) => {
    const outcomes: number[] = []
    let treated = 0
    for (const row of rows) {
      const level = policy.intervene(row)
      if (level != null) treated++
      // Seed per experiment+arm+player → reproducible, arm-independent noise.
      const rng = makeRng(`${spec.seed ?? spec.id}|${policy.id}|${row.p.id}`)
      const final = simulateFinalScore(row, level, rng)
      outcomes.push(outcomeValue(spec.metric, row.a.score, final))
    }
    const m = mean(outcomes)
    const se = stddev(outcomes, m) / Math.sqrt(Math.max(1, outcomes.length))
    return {
      policy,
      n: rows.length,
      treated,
      mean: m,
      ci: [m - 1.96 * se, m + 1.96 * se],
      outcomes,
    }
  })

  // Baseline = a no-action control arm if present, else the first arm.
  const control = arms.find((a) => a.treated === 0) ?? arms[0]
  const ranked = [...arms].sort((a, b) => (betterIsLower ? a.mean - b.mean : b.mean - a.mean))
  const best = ranked[0]
  const uplift = best.mean - control.mean

  // Approximate significance: does the best-vs-control difference CI exclude 0?
  const seDiff = Math.sqrt(
    ((best.ci[1] - best.mean) / 1.96) ** 2 + ((control.ci[1] - control.mean) / 1.96) ** 2,
  )
  const significant = Math.abs(uplift) > 1.96 * seDiff && best.policy.id !== control.policy.id

  const fmt = (v: number) =>
    spec.metric === 'risk_change'
      ? `${v >= 0 ? '+' : ''}${v.toFixed(1)} pts`
      : spec.metric === 'harm_averted'
        ? `${(v * 100).toFixed(1)}%`
        : `${(v * 100).toFixed(0)}%`

  const readout =
    best.policy.id === control.policy.id
      ? `No policy beat the control on ${spec.metric.replace(/_/g, ' ')}.`
      : `${best.policy.label} ${betterIsLower ? 'reduced' : 'improved'} ${spec.metric.replace(/_/g, ' ')} by ${fmt(Math.abs(uplift))} vs control` +
        ` (${best.treated} treated of ${best.n})${significant ? ' — statistically distinguishable.' : ' — not statistically distinguishable at 95%.'}`

  return {
    spec,
    metric: spec.metric,
    betterIsLower,
    arms,
    baselineId: control.policy.id,
    bestId: best.policy.id,
    uplift,
    significant,
    readout,
  }
}
