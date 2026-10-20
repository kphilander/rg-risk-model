// Portable RiskModel artifact — the thing an operator deploys and can re-fit.
//
// Two layers, both interpretable:
//   • markerWeights — a non-negative (monotonic) weighting of the 0–100 marker
//     scores. The 0–100 aggregate (weighted mean) is the ORDINAL risk index that
//     drives the bands; a marker can only ever raise risk.
//   • calibration — maps that ordinal aggregate to a CALIBRATED harm probability.
//     Kept separate from the score on purpose: self-exclusion is a rare,
//     under-ascertained outcome (~5%), so the absolute probability is small even
//     for high-risk players — collapsing the score into it would erase the bands.
//
// The default is fit on a longitudinal research cohort of online bettors. The
// cohort and the fitting code are not distributed; only the fitted parameters
// ship (scripts/model.json).
// An operator re-fits both layers in-browser on their own scored+labelled data
// (see lab/fitModel.ts) — identical feature space, nothing leaves the browser.

import type { MarkerResult } from '../types'

export type Calibration =
  | { type: 'logistic'; a: number; b: number; note?: string }
  | { type: 'isotonic'; knots: { x: number; y: number }[]; note?: string }
  /** Discrete-time hazard (v2): h(month j|S) = sigmoid(alpha_piece(j) + beta·S/100);
   *  the reported probability is p(harm within horizonMonths) = 1 − Π(1 − h). */
  | {
      type: 'hazard'
      horizonMonths: number
      pieceUpperBoundsMonths: number[]
      alphas: number[]
      beta: number
      note?: string
    }
  | { type: 'none' }

/** Months-scale label for the probability a calibration emits ('' for lifetime). */
export function calibrationHorizonLabel(c: Calibration): string {
  return c.type === 'hazard' ? `within ${c.horizonMonths} months` : ''
}

/** Optional learned monotone shape for one marker: a piecewise-linear,
 *  non-decreasing map on the 0–100 marker scale (x strictly increasing).
 *  Learned per-operator from THEIR labels (PAVA on binned outcome rates),
 *  never shipped from the reference cohort — proxy-fitted shapes would not
 *  transfer across marker distributions. */
export interface MarkerTransform {
  x: number[]
  y: number[]
}

export interface ModelMetrics {
  rocAuc?: number
  prAuc?: number
  prBaseline?: number
  multivariateCeilingAuc?: number
  brier?: number
  ece?: number
  n?: number
  positives?: number
  prevalence?: number
  /** Fixed-horizon (hazard) evaluation, when the calibration is time-aware. */
  horizonMonths?: number
  aucAtHorizon?: number
  brierAtHorizon?: number
  eceAtHorizon?: number
  eventsWithinHorizon?: number
  observableAtHorizon?: number
  /** Outcome rate within the horizon, when event counts are not shipped. */
  baseRateAtHorizon?: number
}

export interface RiskModel {
  version: string
  provenance: 'reference-fit' | 'operator-fit' | 'manual' | 'literature-prior'
  /** Non-negative weight per marker id (relative; the aggregate is a weighted mean). */
  markerWeights: Record<string, number>
  /** Optional learned monotone per-marker shapes (operator-fit only). Applied
   *  to marker scores before weighting; explanations keep the raw 0–100 value. */
  markerTransforms?: Record<string, MarkerTransform>
  /** Aggregate (0–100) → harm probability (0–1). */
  calibration: Calibration
  metrics?: ModelMetrics
  fittedOn?: { cohort?: string; n?: number; positives?: number; prevalence?: number; date?: string }
  markersFitted?: string[]
  markersPrior?: string[]
  design?: string
  caveat?: string
}

/** DEFAULT model — transcribed from scripts/model.json (reference fit).
 *  Weights blend a non-negative multivariate logistic (redundancy-aware) with
 *  univariate discrimination (no literature marker zeroed). Calibrated to
 *  RG-coded account closure; ROC-AUC 0.67, Brier 0.044, ECE 0.004. */
export const DEFAULT_RISK_MODEL: RiskModel = {
  version: 'reference-hazard-2026.07',
  provenance: 'reference-fit',
  markerWeights: {
    'tolerance-for-loss': 2.775,
    'impulsive-transactions': 2.232,
    'deposit-escalation': 1.642,
    'loss-of-winnings': 1.065,
    'chasing-losses': 0.813,
    'longer-sessions': 0.636,
    'late-night-play': 0.636,
    'inability-to-stop': 0.636,
    'payment-switching': 0.459,
    'deposit-volatility': 0.292,
    'play-frequency': 0.255,
    'faster-games': 0.25,
    'increasing-bets': 0.215,
  },
  calibration: {
    type: 'hazard',
    horizonMonths: 12,
    pieceUpperBoundsMonths: [3, 6, 12, 24, 36],
    alphas: [-9.0298, -8.71873, -8.61043, -9.76781, -10.12129],
    beta: 4.50275,
    note:
      'Discrete-time hazard: h(month j|S) = sigmoid(alpha_piece(j) + beta·S/100); ' +
      'p(harm within 12 months) = 1 − Π(1 − h). Events = RG-coded closure after the ' +
      'feature window; censoring at dataset end or 36 months.',
  },
  metrics: {
    rocAuc: 0.673,
    prAuc: 0.1093,
    prBaseline: 0.0479,
    multivariateCeilingAuc: 0.6876,
    brier: 0.0445,
    ece: 0.0042,
    prevalence: 0.0479,
    horizonMonths: 12,
    aucAtHorizon: 0.711,
    brierAtHorizon: 0.0226,
    eceAtHorizon: 0.0034,
    baseRateAtHorizon: 0.024,
  },
  fittedOn: { cohort: 'Research cohort (online bettors; not distributed)', prevalence: 0.0479 },
  markersFitted: [
    'play-frequency', 'tolerance-for-loss', 'deposit-volatility', 'increasing-bets',
    'faster-games', 'chasing-losses', 'deposit-escalation', 'impulsive-transactions',
    'payment-switching', 'loss-of-winnings',
  ],
  markersPrior: ['longer-sessions', 'late-night-play', 'inability-to-stop'],
  design:
    'Weighted mean of 0–100 behavioural markers → calibrated harm probability. Non-negative (monotonic) ' +
    'multivariate logistic blended with univariate discrimination, fit on first-90-active-day markers → ' +
    'later RG-coded account closure (leakage-aware, prospective).',
  caveat:
    'Self-exclusion is an under-ascertained proxy (Catania 2021): tuned for recall, false positives expected. ' +
    'Three markers are literature priors (no analog in the fitting data). The calibration is fit on offline ' +
    'marker proxies; operators re-fit it exactly in-browser on their own scored population.',
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

/** Apply a piecewise-linear monotone transform to a 0–100 marker score. */
export function transformMarker(score: number, t: MarkerTransform): number {
  const { x, y } = t
  if (x.length === 0 || x.length !== y.length) return score
  if (score <= x[0]) return y[0]
  if (score >= x[x.length - 1]) return y[y.length - 1]
  for (let i = 1; i < x.length; i++) {
    if (score <= x[i]) {
      const f = (score - x[i - 1]) / Math.max(1e-9, x[i] - x[i - 1])
      return y[i - 1] + f * (y[i] - y[i - 1])
    }
  }
  return score
}

/** Map a 0–100 aggregate to a calibrated harm probability. */
export function calibrate(aggregate: number, calib: Calibration): number {
  if (calib.type === 'logistic') {
    return clamp01(1 / (1 + Math.exp(-(calib.a * (aggregate / 100) + calib.b))))
  }
  if (calib.type === 'hazard') {
    // Survival over the horizon under the piecewise-constant monthly hazard.
    let surv = 1
    for (let j = 1; j <= calib.horizonMonths; j++) {
      let piece = calib.pieceUpperBoundsMonths.length - 1
      for (let k = 0; k < calib.pieceUpperBoundsMonths.length; k++) {
        if (j <= calib.pieceUpperBoundsMonths[k]) {
          piece = k
          break
        }
      }
      const z = calib.alphas[piece] + calib.beta * (aggregate / 100)
      surv *= 1 - clamp01(1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z)))))
    }
    return clamp01(1 - surv)
  }
  if (calib.type === 'isotonic') {
    const k = calib.knots
    if (k.length === 0) return clamp01(aggregate / 100)
    if (aggregate <= k[0].x) return clamp01(k[0].y)
    if (aggregate >= k[k.length - 1].x) return clamp01(k[k.length - 1].y)
    for (let i = 1; i < k.length; i++) {
      if (aggregate <= k[i].x) {
        const t = (aggregate - k[i - 1].x) / Math.max(1e-9, k[i].x - k[i - 1].x)
        return clamp01(k[i - 1].y + t * (k[i].y - k[i - 1].y))
      }
    }
  }
  return clamp01(aggregate / 100)
}

export interface ModelContribution {
  id: string
  label: string
  weight: number
  score: number
  /** weight × score — this marker's share of the (pre-normalised) aggregate. */
  contribution: number
}

export interface ModelResult {
  /** 0–100 ordinal risk index (weighted mean of markers) — drives the bands. */
  aggregate: number
  /** Calibrated harm probability (0–1). */
  probability: number
  contributions: ModelContribution[]
}

/** Score a set of markers through a model: weighted-mean aggregate + calibrated
 *  probability + per-marker contributions (for the explainable-AI panels). */
export function applyModel(markers: MarkerResult[], model: RiskModel): ModelResult {
  let wsum = 0
  let dot = 0
  const contributions: ModelContribution[] = []
  for (const m of markers) {
    const weight = model.markerWeights[m.id] ?? 0
    const t = model.markerTransforms?.[m.id]
    const shaped = t ? transformMarker(m.score, t) : m.score
    wsum += weight
    dot += weight * shaped
    contributions.push({ id: m.id, label: m.label, weight, score: m.score, contribution: weight * shaped })
  }
  const aggregate = wsum > 0 ? dot / wsum : 0
  contributions.sort((a, b) => b.contribution - a.contribution)
  return { aggregate, probability: calibrate(aggregate, model.calibration), contributions }
}
