// Model-card data — the single source for the Governance page + regulator report
// pack. Transcribed from the default fit (core/riskModel.ts + core/config.ts) so the
// UI never imports the analysis artifact at runtime.

export interface MarkerEvidence {
  id: string
  label: string
  weight: number
  fitted: boolean
  source: string
  /** Univariate discrimination of real self-exclusion (0 = none, ~1 = perfect). */
  gini: number | null
  auc: number | null
}

export interface ModelCard {
  name: string
  rulesetVersion: string
  /** Combined score provenance: which data ruleset + which overlay produced the shipped score. */
  composition: string
  modelType: string
  windowDays: number
  validation: {
    design: string
    prevalence: number
    /** ROC-AUC of the deployed rule against the ever-closure label. */
    aucLogistic: number
    /** Constrained multivariate ceiling (the model the weights are derived from). */
    aucCeiling: number
    /** ROC-AUC at the 12-month horizon of the hazard layer. */
    aucAtHorizon: number
    horizonMonths: number
    prAuc: number
    prBaseline: number
    operatingPoint: { recall: number; precision: number }
  }
  markers: MarkerEvidence[]
  /** The staff-observation overlay folded into the shipped score. NOT statistically validated. */
  overlay: {
    name: string
    type: string
    uplift: string
    floor: string
    caveat: string
  }
  limitations: string
  priors: string[]
  history: { version: string; date: string; change: string }[]
}

const LABELS: Record<string, string> = {
  'chasing-losses': 'Chasing losses',
  'increasing-bets': 'Increasing bet sizes',
  'deposit-volatility': 'Deposit volatility',
  'loss-of-winnings': 'Repeated loss of winnings',
  'payment-switching': 'Payment-method switching',
  'impulsive-transactions': 'Impulsive transactions',
  'longer-sessions': 'Longer session durations',
  'play-frequency': 'Play frequency',
  'late-night-play': 'Late-night play',
  'faster-games': 'Shift to faster games',
  'tolerance-for-loss': 'Increasing loss tolerance',
  'inability-to-stop': 'Inability to stop',
  'deposit-escalation': 'Deposit-frequency escalation',
}

// Weights = the shipped blended fit (scripts/model.json: non-negative multivariate
// logistic ⊕ univariate discrimination). gini/auc are the univariate discrimination
// on the same cohort, kept as per-marker evidence provenance.
const RAW: Record<string, { weight: number; fitted: boolean; source: string; gini: number | null; auc: number | null }> = {
  'tolerance-for-loss': { weight: 2.775, fitted: true, source: 'Braverman & Shaffer 2012 (intensity)', gini: 0.288, auc: 0.644 },
  'deposit-escalation': { weight: 1.642, fitted: true, source: 'Auer 2023; Haeusler 2016 (deposits)', gini: 0.263, auc: 0.632 },
  'impulsive-transactions': { weight: 2.232, fitted: true, source: 'Auer 2022 (frequent session depositing)', gini: 0.255, auc: 0.627 },
  'chasing-losses': { weight: 0.813, fitted: true, source: 'Auer 2022 (money lost / chasing)', gini: 0.178, auc: 0.589 },
  'loss-of-winnings': { weight: 1.065, fitted: true, source: 'Haeusler 2016 (reversed withdrawals)', gini: 0.116, auc: 0.558 },
  'payment-switching': { weight: 0.459, fitted: true, source: 'Hopfgartner 2022 (distinct methods)', gini: 0.101, auc: 0.550 },
  'longer-sessions': { weight: 0.636, fitted: false, source: 'Prior — no session-duration data in source', gini: null, auc: null },
  'late-night-play': { weight: 0.636, fitted: false, source: 'Prior — no time-of-day data in source', gini: null, auc: null },
  'inability-to-stop': { weight: 0.636, fitted: false, source: 'Prior — no in-session data in source', gini: null, auc: null },
  'deposit-volatility': { weight: 0.292, fitted: true, source: 'Braverman & Shaffer 2012 (variability)', gini: 0.064, auc: 0.532 },
  'play-frequency': { weight: 0.255, fitted: true, source: 'Braverman & Shaffer 2012 (frequency)', gini: 0.056, auc: 0.528 },
  'faster-games': { weight: 0.25, fitted: true, source: 'Braverman et al. 2013 (cross-game)', gini: 0.029, auc: 0.515 },
  'increasing-bets': { weight: 0.215, fitted: true, source: 'Braverman & Shaffer 2012 (trajectory)', gini: 0.018, auc: 0.509 },
}

export const MODEL_CARD: ModelCard = {
  name: 'RG Risk Model ruleset',
  rulesetVersion: 'reference-fit-2026.07',
  composition: 'reference-hazard-2026.07 + observed-v1',
  modelType: 'Interpretable additive (monotonic) · explainable by construction',
  windowDays: 92,
  validation: {
    design: 'First-90-active-day markers → later RG-coded account closure (leakage-aware, prospective).',
    prevalence: 0.0479,
    aucLogistic: 0.673,
    aucCeiling: 0.6876,
    aucAtHorizon: 0.711,
    horizonMonths: 12,
    prAuc: 0.1093,
    prBaseline: 0.0479,
    operatingPoint: { recall: 0.8, precision: 0.0649 },
  },
  markers: Object.entries(RAW)
    .map(([id, r]) => ({ id, label: LABELS[id], ...r }))
    .sort((a, b) => b.weight - a.weight),
  overlay: {
    name: 'observed-v1',
    type: 'Interpretable heuristic overlay — informed priors, NOT statistically validated',
    uplift:
      'Corroboration uplift, capped at +18 points. Weighted by recency (30-day half-life) and by ' +
      'INCREMENTAL INFORMATION: an observation confirming a data marker already scored high adds ' +
      'almost nothing, while a data-blind emotional/social marker (or one disagreeing with a low ' +
      'data score) carries full weight — so watching a player closely cannot by itself inflate the score.',
    floor:
      'Standing disclosure floor of 50 (Elevated). A critical self-disclosure or third-party concern ' +
      'sets this floor; it does NOT decay by the calendar and clears only when a human logs a resolving ' +
      '/ "no-concern" follow-up (a two-way ratchet).',
    caveat:
      'The overlay weights are hand-set informed priors, not statistically fitted or validated. Only the ' +
      'DATA-derived score is validated (ROC-AUC 0.67 above); the combined shipped score is not. The ' +
      'validated data score is retained separately as `dataScore` and remains individually filterable.',
  },
  limitations:
    'Self-exclusion is an under-ascertained proxy for harm (Catania et al. 2021): many harmed ' +
    'players never self-exclude, so the label is a lower bound. The model is therefore tuned for ' +
    'recall — flagging a player who has not self-excluded is expected, not necessarily an error. ' +
    'Only the marker weights are fitted; the 0–100 marker computations remain rule-based heuristics.',
  priors: ['Longer session durations', 'Late-night play', 'Inability to stop'],
  history: [
    { version: 'heuristic-2026.06', date: 'Jun 2026', change: 'Initial hand-tuned expert weights (unvalidated).' },
    { version: 'evidence-2026.06', date: 'Jun 2026', change: 'Weights refit to real prospective self-exclusion (univariate Gini); sources cited per marker.' },
    { version: 'reference-fit-2026.07', date: 'Jul 2026', change: 'Non-negative multivariate logistic ⊕ univariate blend; calibrated to harm probability (Brier 0.044, ECE 0.004); bands recalibrated to the fitted distribution. Operators can re-fit in-browser.' },
  ],
}
