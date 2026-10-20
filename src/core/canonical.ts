// ---------------------------------------------------------------------------
// CANONICAL DATA CONTRACT
//
// The single, versioned internal schema that everything downstream depends on.
// Operator systems never reach the engine directly — a per-operator ingestion
// adapter maps their feed onto these canonical types (an anti-corruption layer),
// so adding a new operator means adding an adapter, not changing the pipeline.
//
// Two levels live here:
//   1. Granular EVENTS — what real adapters emit (wagers, wallet, sessions, RG).
//   2. The FEATURE WINDOW — the rolling per-player aggregate the engine scores
//      (today this is `PlayerProfile`; a Projection turns events → window).
// ---------------------------------------------------------------------------

import type { DailyActivity, GameSpeed, PlayerProfile } from '../types'

/** Bump on any breaking change to the canonical shapes. Carried on every
 *  envelope so adapters and the engine can evolve independently. */
export const SCHEMA_VERSION = '1.0.0'

/** Pseudonymous, tenant-scoped player reference. Real identity/PII is tokenised
 *  at the ingestion boundary and never enters the platform. */
export type PlayerRef = string

/** Wrapper applied to every inbound event for versioning, idempotency, replay. */
export interface EventEnvelope<T> {
  schemaVersion: string
  tenantId: string
  /** Stable id used for dedup / idempotent upserts and replay. */
  eventId: string
  source: string
  occurredAt: string
  ingestedAt: string
  payload: T
}

export interface IdentityRecord {
  playerRef: PlayerRef
  country: string
  jurisdiction: string
  ageBand: string
  gender: 'M' | 'F' | 'X'
  currency: string
  accountOpenedAt: string
}

export interface WagerEvent {
  type: 'wager'
  playerRef: PlayerRef
  ts: string
  product: string
  gameSpeed: GameSpeed
  /** Total staked. For a single spin this is one wager; for a daily-summary
   *  batch feed it is the day's turnover (with `bets` set to the count). */
  stake: number
  /** Total returned to the player over `stake`. */
  payout: number
  /** Number of individual bets this row represents. Omit (→ 1) for per-spin
   *  streaming; set for daily-aggregate batch feeds. */
  bets?: number
  /** Largest single stake in the row, when known (batch feeds). */
  peakStake?: number
}

export interface WalletEvent {
  type: 'wallet'
  playerRef: PlayerRef
  ts: string
  kind: 'deposit' | 'withdrawal' | 'withdrawal_cancel'
  amount: number
  method: string
  /** Operator-normalised outcome: settled / failed / reversed. */
  status: 'settled' | 'failed' | 'reversed'
}

export interface SessionEvent {
  type: 'session'
  playerRef: PlayerRef
  ts: string
  durationMin: number
  /** 0–1 share of the session in overnight hours (00:00–06:00 local). */
  nightFraction: number
}

export interface RgEvent {
  type: 'rg'
  playerRef: PlayerRef
  ts: string
  kind: 'self_exclusion' | 'cool_off' | 'limit_set' | 'reality_check'
}

/** The discriminated union an ingestion adapter produces. */
export type CanonicalEvent = WagerEvent | WalletEvent | SessionEvent | RgEvent

// --- Feature window (what the scoring engine consumes) ---------------------

/** The rolling per-player feature window the engine scores. Aliased to the
 *  existing domain type so the engine is unchanged; a Projection builds this
 *  from a stream/batch of CanonicalEvents for real operators. */
export type CanonicalPlayer = PlayerProfile
export type DayWindow = DailyActivity
