// Example intervention experiments — declarative ExperimentSpecs that show how
// little it takes to pose a real RG research question. Add one here (or via
// registerExperiment) and it appears in the Lab. See EXTENDING.md.

import type { ExperimentSpec, Policy, Row } from './experiment'

const control: Policy = { id: 'control', label: 'No action (control)', intervene: () => null }

/** Act at each eligible player's recommended escalation level. */
const recommended = (eligible: (r: Row) => boolean): Policy['intervene'] => (r) =>
  eligible(r) ? r.a.recommendedLevel : null

export const EXPERIMENTS: ExperimentSpec[] = [
  {
    id: 'escalation-threshold',
    name: 'Earlier intervention threshold',
    question: 'Does intervening at Elevated (instead of waiting for High) avert more harm?',
    metric: 'harm_averted',
    cohort: (r) => r.a.score >= 40,
    arms: [
      control,
      { id: 'early', label: 'Act at Elevated+ (≥40)', intervene: recommended((r) => r.a.score >= 40) },
      { id: 'standard', label: 'Act at High+ only (≥60)', intervene: recommended((r) => r.a.score >= 60) },
    ],
  },
  {
    id: 'controls-vs-outreach',
    name: 'Controls vs outreach for High risk',
    question: 'For High-risk players, do deposit controls (L4) reduce risk more than outreach (L3)?',
    metric: 'risk_change',
    cohort: (r) => r.a.band.id === 'high',
    arms: [
      control,
      { id: 'outreach', label: 'Operator outreach (L3)', intervene: () => 3 },
      { id: 'controls', label: 'Apply controls (L4)', intervene: () => 4 },
    ],
  },
  {
    id: 'treat-the-accelerating',
    name: 'Treat the accelerating',
    question: 'Among rising Moderate/Elevated players, does early action avert harm?',
    metric: 'harm_averted',
    cohort: (r) => (r.a.band.id === 'moderate' || r.a.band.id === 'elevated') && r.f.velocityPerWeek >= 1,
    arms: [
      control,
      { id: 'nudge', label: 'Self-help nudge (L2)', intervene: () => 2 },
      { id: 'outreach', label: 'Operator outreach (L3)', intervene: () => 3 },
    ],
  },
]

// --- User-defined experiments (point-and-click builder in the Lab) ----------

const CUSTOM: ExperimentSpec[] = []
export function registerExperiment(spec: ExperimentSpec) {
  CUSTOM.push(spec)
}
export function allExperiments(): ExperimentSpec[] {
  return [...EXPERIMENTS, ...CUSTOM]
}

export interface CustomParams {
  minScore: number
  risingOnly: boolean
  treatmentLevel: number
  metric: ExperimentSpec['metric']
}

/** Build a runnable spec from simple UI parameters. */
export function buildCustomExperiment(params: CustomParams): ExperimentSpec {
  const { minScore, risingOnly, treatmentLevel, metric } = params
  return {
    id: `custom-${minScore}-${risingOnly ? 'rising' : 'all'}-L${treatmentLevel}-${metric}`,
    name: 'Custom experiment',
    question: `Effect of an L${treatmentLevel} intervention on players scoring ≥${minScore}${risingOnly ? ' and rising' : ''}.`,
    metric,
    cohort: (r) => r.a.score >= minScore && (!risingOnly || r.f.velocityPerWeek >= 1),
    arms: [
      control,
      { id: 'treat', label: `Intervene at L${treatmentLevel}`, intervene: () => treatmentLevel },
    ],
  }
}
