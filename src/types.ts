// Core domain types for the player-protection platform.
// All data is synthetic and generated at runtime.

import type { InteractionKind, InteractionMethod, InteractionOutcome, ObservedSignal } from './core/observedMarkers'

export type RiskBandId = 'low' | 'moderate' | 'elevated' | 'high' | 'critical'

export interface RiskBand {
  id: RiskBandId
  label: string
  /** Inclusive lower bound of the 0-100 score range. */
  min: number
  /** Inclusive upper bound of the 0-100 score range. */
  max: number
  color: string
  /** Tailwind-friendly soft background tint. */
  tint: string
  description: string
}

export type GameSpeed = 'slow' | 'medium' | 'fast'

/** One day of a player's gambling activity. */
export interface DailyActivity {
  /** ISO date (yyyy-MM-dd). */
  date: string
  /** Day index within the window, 0 = earliest. */
  dayIndex: number
  played: boolean
  sessions: number
  /** Total minutes played across all sessions that day. */
  minutes: number
  bets: number
  /** Average stake per bet (account currency). */
  avgStake: number
  peakStake: number
  deposits: number
  depositCount: number
  withdrawals: number
  withdrawalCancellations: number
  /** Net monetary result for the player (negative = player lost). */
  net: number
  /** Dominant game speed that day. */
  gameSpeed: GameSpeed
  paymentMethod: string
  /** Fraction (0-1) of play that occurred between 00:00 and 06:00 local time. */
  nightFraction: number
}

export type ArchetypeId =
  | 'recreational'
  | 'regular'
  | 'rising'
  | 'chaser'
  | 'highroller'
  | 'critical'

export interface PlayerProfile {
  id: string
  handle: string
  country: string
  jurisdiction: string
  ageBand: string
  gender: 'M' | 'F' | 'X'
  currency: string
  /** Days since account creation. */
  accountAgeDays: number
  /** ISO datetime of most recent activity. */
  lastActive: string
  archetype: ArchetypeId
  activity: DailyActivity[]
}

/** Result of a single behavioral marker calculation. */
export interface MarkerResult {
  id: string
  label: string
  /** 0-100 contribution of this marker. */
  score: number
  /** Human-readable value summary (e.g. "+38% over 92d"). */
  value: string
  /** Plain-language explanation of why this marker fired. */
  explanation: string
  /** Relative weight of this marker in the aggregate. */
  weight: number
}

export interface RiskAssessment {
  playerId: string
  /** Overall 0-100 risk score (data-derived, then folded with staff observations). */
  score: number
  /** Calibrated harm probability (0-1) from the fitted model — the absolute-risk read. */
  probability?: number
  band: RiskBand
  /** Data-derived score before the interaction-log overlay (present when observations applied). */
  dataScore?: number
  /** Staff-observation signal folded into the score (present when interactions exist). */
  observed?: ObservedSignal
  markers: MarkerResult[]
  /** Markers sorted by weighted contribution, highest first. */
  topMarkers: MarkerResult[]
  /** Daily rolling risk score across the window, for trend charts. */
  trend: { date: string; score: number }[]
  /** Recommended intervention escalation level (1-5). */
  recommendedLevel: number
  /** Percentile of this score vs the rest of the portfolio (0-100). */
  peerPercentile: number
  /** 7-day change in the rolling score. */
  delta7d: number
}

export type InterventionLevel = 1 | 2 | 3 | 4 | 5

export interface InterventionAction {
  id: string
  playerId: string
  playerHandle: string
  level: InterventionLevel
  action: string
  note: string
  /** Risk score at the time the action was logged. */
  riskAtTime: number
  operator: string
  timestamp: string
  status: 'logged' | 'resolved'
}

/** A staff-recorded interaction with a player — the qualitative input the risk
 *  model folds in alongside the data-derived markers. */
export interface Interaction {
  id: string
  playerId: string
  /** ISO datetime the interaction occurred. */
  timestamp: string
  kind: InteractionKind
  method: InteractionMethod
  /** Observed player-health marker slugs (see core/observedMarkers.ts). */
  markers: string[]
  /** Close-out recorded on a follow-up — clears/dampens the overlay (two-way ratchet). */
  outcome?: InteractionOutcome
  note: string
  operator: string
}
