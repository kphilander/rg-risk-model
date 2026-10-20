// ---------------------------------------------------------------------------
// TENANT & RISK CONFIGURATION
//
// Configuration is a feature, not a fork. Marker weights, band thresholds, and
// the intervention ladder are data — injected into the scoring engine per
// tenant + jurisdiction — so one codebase serves every operator and every
// regulator's rule pack (UKGC ≠ MGA ≠ Ontario …) without branching.
// ---------------------------------------------------------------------------

import type { RiskBand, RiskBandId } from '../types'
import { RISK_BANDS, ESCALATION } from '../lib/riskBands'
import { SCHEMA_VERSION } from './canonical'
import { DEFAULT_RISK_MODEL, type RiskModel } from './riskModel'

/** Who we are scoring for. Resolved once per request/session at the edge. */
export interface TenantContext {
  tenantId: string
  operatorName: string
  /** Regulatory jurisdiction key, selects a rule pack (e.g. 'UKGC', 'MGA'). */
  jurisdiction: string
  /** Settlement currency for display. */
  currency: string
  locale?: string
}

export interface EscalationStep {
  level: number
  action: string
  detail: string
}

/** Everything the engine needs that an operator/regulator may tune. */
export interface RiskConfig {
  schemaVersion: string
  /** Version of the scoring ruleset — enables shadow/canary rollout + audit. */
  rulesetVersion: string
  /** Length of the rolling behavioural window, in days. */
  windowDays: number
  /** Per-marker aggregate weights, keyed by marker id. */
  markerWeights: Record<string, number>
  /** Band thresholds + presentation (0–100 → band). */
  bands: RiskBand[]
  /** Recommended intervention per band id. */
  escalation: Record<RiskBandId, EscalationStep>
  /** Fitted + calibrated risk model: marker weights, calibration, provenance. */
  model: RiskModel
}

/** Original hand-tuned weights (kept for reference / A-B comparison). */
export const HEURISTIC_MARKER_WEIGHTS: Record<string, number> = {
  'chasing-losses': 1.4,
  'increasing-bets': 1.2,
  'deposit-volatility': 0.8,
  'loss-of-winnings': 1.0,
  'payment-switching': 0.6,
  'impulsive-transactions': 0.9,
  'longer-sessions': 0.9,
  'play-frequency': 1.0,
  'late-night-play': 0.7,
  'faster-games': 0.9,
  'tolerance-for-loss': 1.2,
  'inability-to-stop': 1.3,
  'deposit-escalation': 1.0,
}

/**
 * EVIDENCE-BASED weights — each marker weighted by its standalone discrimination
 * (univariate AUC → Gini) of REAL prospective self-exclusion in the research
 * cohort behind the default fit (not distributed). Marker SELECTION is
 * literature-anchored; three markers have no analog in the fitting data and
 * remain informed priors (flagged in RULESET_PROVENANCE).
 */
export const EVIDENCE_MARKER_WEIGHTS: Record<string, number> = {
  'tolerance-for-loss': 1.48, // intensity — Braverman & Shaffer 2012
  'deposit-escalation': 1.4, // deposit frequency — Auer 2023; Haeusler 2016
  'impulsive-transactions': 1.37, // deposits/active day — Auer 2022
  'chasing-losses': 1.1, // money lost — Auer 2022
  'loss-of-winnings': 0.89, // reversed withdrawals — Haeusler 2016
  'payment-switching': 0.84, // distinct payment methods — Hopfgartner 2022
  'longer-sessions': 0.84, // PRIOR (no session-duration data)
  'late-night-play': 0.84, // PRIOR (no time-of-day data)
  'inability-to-stop': 0.84, // PRIOR (no in-session data)
  'deposit-volatility': 0.72, // variability — Braverman & Shaffer 2012
  'play-frequency': 0.69, // frequency — Braverman & Shaffer 2012
  'faster-games': 0.6, // cross-game involvement — Braverman et al. 2013
  'increasing-bets': 0.56, // trajectory — Braverman & Shaffer 2012
}

/** Provenance for the active ruleset — surfaced in the UI + audit/compliance. */
export const RULESET_PROVENANCE = {
  version: 'reference-fit-2026.07',
  basis: 'Weighted mean of markers → calibrated harm probability; weights fitted (non-negative, blended multivariate + univariate) to real prospective self-exclusion in a longitudinal research cohort (not distributed).',
  design: 'First-90-active-day markers → later RG-coded account closure (leakage-aware).',
  validation: { rocAuc: 0.673, prAuc: 0.109, brier: 0.0445, ece: 0.0042, prevalence: 0.0479 },
  label: 'Self-exclusion is an under-ascertained proxy (Catania 2021): tuned for recall; ' +
    'flagging non-excluded players as at-risk is expected, not error.',
  priors: ['longer-sessions', 'late-night-play', 'inability-to-stop'],
}

/** Active default weights = the fitted reference model's marker weights (blended
 *  non-negative multivariate + univariate; see core/riskModel.ts).
 *  EVIDENCE_MARKER_WEIGHTS (univariate-only) is retained above for reference/history. */
export const DEFAULT_MARKER_WEIGHTS = DEFAULT_RISK_MODEL.markerWeights

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  schemaVersion: SCHEMA_VERSION,
  rulesetVersion: RULESET_PROVENANCE.version,
  windowDays: 92,
  markerWeights: DEFAULT_MARKER_WEIGHTS,
  bands: RISK_BANDS,
  escalation: ESCALATION,
  model: DEFAULT_RISK_MODEL,
}

/** Build a band set from four cut-points (where moderate/elevated/high/critical
 *  begin), reusing the default colours/labels — lets a jurisdiction tighten
 *  thresholds without restating presentation. */
function bandsFromCuts([m, e, h, c]: [number, number, number, number]): RiskBand[] {
  const cuts = [0, m, e, h, c]
  return RISK_BANDS.map((b, i) => ({
    ...b,
    min: cuts[i],
    max: i < 4 ? cuts[i + 1] - 1 : 100,
  }))
}

/**
 * Jurisdiction rule packs — illustrative overrides layered over the default.
 * A stricter regulator lowers the bands (players escalate sooner) and can
 * re-weight markers it cares about most.
 */
export const JURISDICTION_PACKS: Record<string, Partial<RiskConfig>> = {
  UKGC: {
    // UK: escalate earlier; weight affordability-style markers harder.
    bands: bandsFromCuts([15, 32, 52, 72]),
    markerWeights: { ...DEFAULT_MARKER_WEIGHTS, 'chasing-losses': 1.7, 'deposit-escalation': 1.3, 'increasing-bets': 1.4 },
  },
  MGA: {
    bands: bandsFromCuts([20, 40, 60, 80]),
  },
  ON: {
    // Ontario (iGO): emphasise time/session markers.
    bands: bandsFromCuts([18, 38, 58, 78]),
    markerWeights: { ...DEFAULT_MARKER_WEIGHTS, 'longer-sessions': 1.2, 'play-frequency': 1.3, 'late-night-play': 1.0 },
  },
}

/** Resolve the effective config for a tenant: default ⊕ jurisdiction pack. */
export function resolveRiskConfig(tenant: TenantContext): RiskConfig {
  const pack = JURISDICTION_PACKS[tenant.jurisdiction] ?? {}
  return {
    ...DEFAULT_RISK_CONFIG,
    ...pack,
    markerWeights: { ...DEFAULT_RISK_CONFIG.markerWeights, ...(pack.markerWeights ?? {}) },
    bands: pack.bands ?? DEFAULT_RISK_CONFIG.bands,
    escalation: { ...DEFAULT_RISK_CONFIG.escalation, ...(pack.escalation ?? {}) },
    model: pack.model ?? DEFAULT_RISK_CONFIG.model,
  }
}
