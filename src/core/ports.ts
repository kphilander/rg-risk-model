// ---------------------------------------------------------------------------
// PORTS (hexagonal architecture)
//
// Every integration path is one of these interfaces. The app depends only on
// the ports; concrete adapters (synthetic, CSV, REST, streaming, webhook,
// localStorage…) are wired in at the composition root (runtime.ts). Swapping
// "synthetic data" for "a real operator feed" is a one-line change there — no
// page, store, or engine code changes.
// ---------------------------------------------------------------------------

import type { InterventionAction, RiskAssessment } from '../types'
import type { CanonicalEvent, CanonicalPlayer } from './canonical'
import type { RiskConfig, TenantContext } from './config'
import type { PortfolioStats } from '../engine/scoring'

/**
 * INGESTION ADAPTER — the anti-corruption layer. One per operator/PAM. Maps a
 * raw operator record onto canonical events. This is the only place that knows
 * an operator's wire format.
 */
export interface IngestionAdapter<TRaw = unknown> {
  readonly id: string
  /** Map one raw operator record to zero or more canonical events. */
  toCanonical(raw: TRaw, tenant: TenantContext): CanonicalEvent[]
}

/**
 * PROJECTION — folds a stream/batch of canonical events into the per-player
 * feature window the engine scores. (Synthetic data skips this by producing
 * windows directly; real operators run their events through here.)
 */
export interface Projection {
  project(events: CanonicalEvent[]): CanonicalPlayer[]
}

/**
 * DATA SOURCE — where feature windows come from. `load` is the batch/bootstrap
 * path; `subscribe` is the optional real-time path (returns an unsubscribe fn).
 * Synthetic, CSV-batch, REST-pull and streaming sources all implement this.
 */
export interface DataSource {
  readonly id: string
  load(tenant: TenantContext): CanonicalPlayer[] | Promise<CanonicalPlayer[]>
  subscribe?(tenant: TenantContext, onEvents: (e: CanonicalEvent[]) => void): () => void
}

/**
 * SCORING ENGINE — the rule-based engine today; a remote scoring service
 * tomorrow. Same interface, so the UI never knows the difference.
 */
export interface ScoringEngine {
  readonly rulesetVersion: string
  assess(player: CanonicalPlayer, config: RiskConfig): RiskAssessment
  assessAll(players: CanonicalPlayer[], config: RiskConfig): Map<string, RiskAssessment>
  summarize(players: CanonicalPlayer[], assessments: Map<string, RiskAssessment>): PortfolioStats
}

/**
 * AUDIT SINK — durable, append-only record of every intervention (regulator
 * evidence). localStorage today; an immutable/WORM store + warehouse later.
 */
export interface AuditSink {
  load(tenant: TenantContext): InterventionAction[] | Promise<InterventionAction[]>
  append(entry: InterventionAction): void | Promise<void>
  update(id: string, patch: Partial<InterventionAction>): void | Promise<void>
}

/**
 * ACTION SINK — write-back into the operator's system (apply limits, send a
 * nudge, push to CRM, self-exclude). No-op/console in the demo; webhook or
 * direct PAM calls in production.
 */
export interface ActionSink {
  readonly id: string
  dispatch(action: InterventionAction, tenant: TenantContext): void | Promise<void>
}
