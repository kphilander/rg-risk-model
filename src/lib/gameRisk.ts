// ---------------------------------------------------------------------------
// Game-risk instrument: scores the STRUCTURAL risk of games (not players).
//
// Adapted from the evidence-based structural-characteristics literature
// (Griffiths 1993; Parke & Griffiths 2007) and multi-dimension product-risk
// instruments in the AsTERiG lineage (Meyer et al. 2011). Ten operator-editable
// questions across three dimensions produce per-dimension subscores, an overall
// 0-100 score, a 4-tier band, top drivers, and recommended mitigations.
//
// Pure and deterministic: same answers → same profile. No randomness, no clock.
// ---------------------------------------------------------------------------

export type GameBand = 'low' | 'moderate' | 'elevated' | 'high'

export interface GameBandInfo {
  id: GameBand
  /** Tier label shown in badges (Tier 1-4). */
  label: string
  /** Plain name of the band. */
  name: string
  /** Inclusive lower bound of the 0-100 overall score. */
  min: number
  /** Inclusive upper bound. */
  max: number
  color: string
  tint: string
  description: string
}

// Games get their own 4-tier scale — deliberately NOT the 5-band player scale.
// Cuts at 25 / 50 / 75.
export const GAME_BANDS: GameBandInfo[] = [
  {
    id: 'low',
    label: 'Tier 1',
    name: 'Low structural risk',
    min: 0,
    max: 24,
    color: '#5b6472',
    tint: 'rgba(91, 100, 114, 0.14)',
    description: 'Standard profile. Baseline safer-gambling tooling is sufficient.',
  },
  {
    id: 'moderate',
    label: 'Tier 2',
    name: 'Moderate structural risk',
    min: 25,
    max: 49,
    color: '#0e8d7c',
    tint: 'rgba(14, 141, 124, 0.13)',
    description: 'Some accelerating features. Standard mitigations advised.',
  },
  {
    id: 'elevated',
    label: 'Tier 3',
    name: 'Elevated structural risk',
    min: 50,
    max: 74,
    color: '#c46a1c',
    tint: 'rgba(255, 159, 10, 0.16)',
    description: 'Multiple risk-bearing features. Targeted mitigations before prominent placement.',
  },
  {
    id: 'high',
    label: 'Tier 4',
    name: 'High structural risk',
    min: 75,
    max: 100,
    color: '#e55a2b',
    tint: 'rgba(229, 90, 43, 0.15)',
    description: 'Structurally intensive product. Comprehensive mitigation recommended.',
  },
]

export function bandForGameScore(score: number): GameBandInfo {
  const clamped = Math.max(0, Math.min(100, score))
  return (
    GAME_BANDS.find((b) => clamped >= b.min && clamped <= b.max) ??
    GAME_BANDS[GAME_BANDS.length - 1]
  )
}

/** Tier number (1-4) for a band — Tier 3+ is the "risky" cut used across the UI. */
export function tierOf(band: GameBandInfo): number {
  return GAME_BANDS.findIndex((b) => b.id === band.id) + 1
}

// ── Dimensions ───────────────────────────────────────────────────────────────

export type GameDimension = 'event-frequency' | 'bet-structure' | 'volatility-reward'

export const GAME_DIMENSIONS: { id: GameDimension; label: string; short: string; blurb: string }[] = [
  {
    id: 'event-frequency',
    label: 'Event frequency',
    short: 'Speed',
    blurb: 'How fast and uninterrupted the play loop is — rounds per minute, turbo features, breaks.',
  },
  {
    id: 'bet-structure',
    label: 'Bet structure',
    short: 'Stakes',
    blurb: 'How stakes can escalate — stake span, side-bets, and how close the wallet sits to play.',
  },
  {
    id: 'volatility-reward',
    label: 'Volatility & reward',
    short: 'Reward',
    blurb: 'How the reward schedule reinforces play — payback, hit rate, and jackpot salience.',
  },
]

export function dimensionLabel(id: GameDimension): string {
  return GAME_DIMENSIONS.find((d) => d.id === id)?.label ?? id
}

// ── Questions ────────────────────────────────────────────────────────────────

export interface GameQuestion {
  id: string
  prompt: string
  dimension: GameDimension
  type: 'binary' | 'numeric' | 'likert'
  /** Relative weight of this item in the subscore/overall aggregation. */
  weight: number
  /** For binary items: which answer is the risky one. */
  riskAnswer?: 'yes' | 'no'
  /** For numeric/likert items: value range and direction of risk. */
  scale?: { min: number; max: number; higherIsRiskier: boolean }
  /** Display unit for numeric inputs (e.g. "s", "×", "%"). */
  unit?: string
  /** Evidence note surfaced in the ⓘ tooltip. */
  whyItMatters: { body: string; citation: string }
}

export const GAME_QUESTIONS: GameQuestion[] = [
  // ---- Event frequency -----------------------------------------------------
  {
    id: 'roundSeconds',
    prompt: 'Time per round at maximum speed',
    dimension: 'event-frequency',
    type: 'numeric',
    weight: 1.6,
    scale: { min: 2, max: 60, higherIsRiskier: false },
    unit: 's',
    whyItMatters: {
      body: 'Shorter bet-to-outcome intervals allow more wagers per hour and leave less room for reflection; speed of play is the most consistently implicated structural feature.',
      citation: 'Harris & Griffiths 2018 (speed of play)',
    },
  },
  {
    id: 'turboMode',
    prompt: 'Turbo / fast-play mode available',
    dimension: 'event-frequency',
    type: 'binary',
    weight: 1.0,
    riskAnswer: 'yes',
    whyItMatters: {
      body: 'Player-selectable turbo modes compress the event cycle further and are preferentially used during loss-chasing episodes.',
      citation: 'Blaszczynski et al. 2005 (EGM structural characteristics)',
    },
  },
  {
    id: 'skipAnimation',
    prompt: 'Outcome animations can be skipped',
    dimension: 'event-frequency',
    type: 'binary',
    weight: 0.7,
    riskAnswer: 'yes',
    whyItMatters: {
      body: 'Skipping result animations removes the natural pause between outcome and next stake, tightening the reinforcement loop.',
      citation: 'Griffiths 1993 (structural characteristics)',
    },
  },
  {
    id: 'forcedPauses',
    prompt: 'Forced pauses interrupt continuous play',
    dimension: 'event-frequency',
    type: 'binary',
    weight: 0.9,
    riskAnswer: 'no',
    whyItMatters: {
      body: 'Enforced breaks in play (or natural settlement delays) interrupt dissociative "dark flow" states; their absence enables unbroken sessions.',
      citation: 'Blaszczynski et al. 2016 (breaks in play)',
    },
  },
  // ---- Bet structure ---------------------------------------------------------
  {
    id: 'stakeSpan',
    prompt: 'Stake span: maximum ÷ minimum stake',
    dimension: 'bet-structure',
    type: 'numeric',
    weight: 1.1,
    scale: { min: 1, max: 500, higherIsRiskier: true },
    unit: '×',
    whyItMatters: {
      body: 'A wide stake ladder lets losses be chased by escalating bet size inside the same game rather than by playing longer.',
      citation: 'Meyer et al. 2011 (AsTERiG stake criteria)',
    },
  },
  {
    id: 'sideBets',
    prompt: 'Side-bets or double-up (gamble) feature',
    dimension: 'bet-structure',
    type: 'binary',
    weight: 0.8,
    riskAnswer: 'yes',
    whyItMatters: {
      body: 'Gamble/double-up features re-stake a win before it is banked, converting one wager into a chain of higher-variance wagers.',
      citation: 'Griffiths 1993 (structural characteristics)',
    },
  },
  {
    id: 'inSessionDeposit',
    prompt: 'Deposit prompt available mid-session',
    dimension: 'bet-structure',
    type: 'binary',
    weight: 1.2,
    riskAnswer: 'yes',
    whyItMatters: {
      body: 'One-tap deposits inside the game collapse the distance between wallet and wager — a key accessibility feature separating a depleted balance from a stopped session.',
      citation: 'Parke & Griffiths 2007 (structural characteristics)',
    },
  },
  // ---- Volatility & reward ---------------------------------------------------
  {
    id: 'rtp',
    prompt: 'Return to player (RTP)',
    dimension: 'volatility-reward',
    type: 'numeric',
    weight: 0.8,
    scale: { min: 80, max: 99, higherIsRiskier: false },
    unit: '%',
    whyItMatters: {
      body: 'Lower payback drains a fixed bankroll faster for the same tempo, raising the cost-of-play the player rarely perceives.',
      citation: 'Harrigan & Dixon 2009 (PAR sheets & payback)',
    },
  },
  {
    id: 'hitFrequency',
    prompt: 'Hit frequency: share of rounds paying anything',
    dimension: 'volatility-reward',
    type: 'numeric',
    weight: 0.9,
    scale: { min: 5, max: 60, higherIsRiskier: true },
    unit: '%',
    whyItMatters: {
      body: 'Frequent small returns — many below the stake — keep the reinforcement rate high and can disguise a steady net loss as winning.',
      citation: 'Dixon et al. 2010 (losses disguised as wins)',
    },
  },
  {
    id: 'jackpotVolatility',
    prompt: 'Jackpot & big-win salience (volatility profile)',
    dimension: 'volatility-reward',
    type: 'likert',
    weight: 1.0,
    scale: { min: 1, max: 5, higherIsRiskier: true },
    whyItMatters: {
      body: 'Prominent jackpots and near-miss presentation inflate win expectancy and sustain play through long losing stretches.',
      citation: 'Parke & Griffiths 2007 (near misses/structural characteristics)',
    },
  },
]

export function questionById(id: string): GameQuestion | undefined {
  return GAME_QUESTIONS.find((q) => q.id === id)
}

// ── Mitigations ──────────────────────────────────────────────────────────────

export interface GameMitigation {
  id: string
  label: string
  dimension: GameDimension
  /** Only recommended when the game's answer matches (e.g. turbo exists). */
  requires?: { questionId: string; equals: boolean }
}

// Small library keyed by dimension; order within a dimension = preference order.
const MITIGATIONS: GameMitigation[] = [
  {
    id: 'disable-turbo',
    label: 'Disable turbo mode by default',
    dimension: 'event-frequency',
    requires: { questionId: 'turboMode', equals: true },
  },
  {
    id: 'mandatory-break',
    label: 'Mandatory break after 50 uninterrupted rounds',
    dimension: 'event-frequency',
    requires: { questionId: 'forcedPauses', equals: false },
  },
  {
    id: 'reality-checks',
    label: 'Expose per-session reality checks (time + net spend)',
    dimension: 'event-frequency',
  },
  {
    id: 'remove-quick-deposit',
    label: 'Remove in-session deposit prompts',
    dimension: 'bet-structure',
    requires: { questionId: 'inSessionDeposit', equals: true },
  },
  {
    id: 'gamble-off-default',
    label: 'Ship with the double-up / gamble feature off by default',
    dimension: 'bet-structure',
    requires: { questionId: 'sideBets', equals: true },
  },
  {
    id: 'conservative-stakes',
    label: 'Default to a conservative stake ladder; high stakes opt-in',
    dimension: 'bet-structure',
  },
  {
    id: 'surface-rtp',
    label: 'Surface RTP and expected cost-per-hour in-game',
    dimension: 'volatility-reward',
  },
  {
    id: 'honest-outcomes',
    label: 'Suppress celebratory effects on returns below stake',
    dimension: 'volatility-reward',
  },
]

// ── Scoring ──────────────────────────────────────────────────────────────────

export interface GameDriver {
  id: string
  prompt: string
  dimension: GameDimension
  /** Normalised risk of this item, 0-100. */
  risk: number
  weight: number
}

export interface GameRiskProfile {
  /** Weighted mean across all answered items, 0-100. */
  overall: number
  band: GameBandInfo
  /** Weighted subscore per dimension, 0-100. */
  dimensions: Record<GameDimension, number>
  /** Top 3 items by weighted risk contribution. */
  drivers: GameDriver[]
  /** 2-4 recommended mitigations, keyed to the riskiest dimensions. */
  mitigations: GameMitigation[]
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

/** Normalise one answer to risk in [0, 1]. Missing answers score 0. */
function itemRisk(q: GameQuestion, answer: number | boolean | undefined): number {
  if (answer === undefined) return 0
  if (q.type === 'binary') {
    const yes = answer === true
    return (q.riskAnswer === 'no' ? !yes : yes) ? 1 : 0
  }
  const scale = q.scale
  if (!scale || typeof answer === 'boolean') return 0
  const span = scale.max - scale.min
  if (span <= 0) return 0
  const t = clamp01((answer - scale.min) / span)
  return scale.higherIsRiskier ? t : 1 - t
}

/** How many mitigations each band gets (2-4, more as the tier rises). */
const MITIGATION_COUNT: Record<GameBand, number> = {
  low: 2,
  moderate: 3,
  elevated: 3,
  high: 4,
}

/** Score a game from its answer sheet. Pure and deterministic. */
export function scoreGame(answers: Record<string, number | boolean>): GameRiskProfile {
  const risks = GAME_QUESTIONS.map((q) => ({ q, risk: itemRisk(q, answers[q.id]) }))

  // Per-dimension weighted subscores.
  const dimensions = {} as Record<GameDimension, number>
  for (const dim of GAME_DIMENSIONS) {
    const items = risks.filter((r) => r.q.dimension === dim.id)
    const wSum = items.reduce((s, r) => s + r.q.weight, 0)
    const rSum = items.reduce((s, r) => s + r.risk * r.q.weight, 0)
    dimensions[dim.id] = wSum > 0 ? Math.round((rSum / wSum) * 100) : 0
  }

  // Overall = weighted mean across ALL items (not the mean of subscores).
  const totalW = risks.reduce((s, r) => s + r.q.weight, 0)
  const overall =
    totalW > 0
      ? Math.round((risks.reduce((s, r) => s + r.risk * r.q.weight, 0) / totalW) * 100)
      : 0
  const band = bandForGameScore(overall)

  // Top 3 drivers by weighted contribution (stable question order breaks ties).
  const drivers: GameDriver[] = [...risks]
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r.risk * b.r.q.weight - a.r.risk * a.r.q.weight || a.i - b.i)
    .slice(0, 3)
    .filter((x) => x.r.risk > 0)
    .map(({ r }) => ({
      id: r.q.id,
      prompt: r.q.prompt,
      dimension: r.q.dimension,
      risk: Math.round(r.risk * 100),
      weight: r.q.weight,
    }))

  // Mitigations: walk dimensions riskiest-first, keep those whose trigger
  // condition matches this game's answers, cap two per dimension.
  const dimOrder = [...GAME_DIMENSIONS].sort(
    (a, b) => dimensions[b.id] - dimensions[a.id] ||
      GAME_DIMENSIONS.findIndex((d) => d.id === a.id) - GAME_DIMENSIONS.findIndex((d) => d.id === b.id),
  )
  const applicable = dimOrder.flatMap((dim) =>
    MITIGATIONS.filter(
      (m) =>
        m.dimension === dim.id &&
        (!m.requires || answers[m.requires.questionId] === m.requires.equals),
    ).slice(0, 2),
  )
  const mitigations = applicable.slice(0, Math.max(2, MITIGATION_COUNT[band.id]))

  return { overall, band, dimensions, drivers, mitigations }
}
