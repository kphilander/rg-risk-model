// REFERENCE ADAPTER — batch CSV / SFTP ingestion (the lowest-common-denominator
// path most operators can deliver day one). Shows the anti-corruption mapping
// from a raw operator row onto canonical events. Not wired to a file reader in
// the demo — it documents the seam an operator integration drops into.
//
// Pipeline:  raw rows → CsvWalletAdapter.toCanonical → [CanonicalEvent] →
//            Projection.project → CanonicalPlayer[] → ScoringEngine.

import type { CanonicalEvent, IdentityRecord, WalletEvent } from '../core/canonical'
import type { GameSpeed } from '../types'
import type { IngestionAdapter } from '../core/ports'
import type { TenantContext } from '../core/config'

/** Shape of one row in an operator's wallet/transaction export (example). */
export interface RawWalletRow {
  player_id: string
  txn_type: string // operator-specific, e.g. "DEP" | "WD" | "WD_CANCEL"
  amount_eur: string
  method: string
  status: string // operator-specific, e.g. "S" | "F" | "R"
  processed_at: string
}

const TXN_KIND: Record<string, WalletEvent['kind']> = {
  DEP: 'deposit',
  WD: 'withdrawal',
  WD_CANCEL: 'withdrawal_cancel',
}
const TXN_STATUS: Record<string, WalletEvent['status']> = {
  S: 'settled',
  F: 'failed',
  R: 'reversed',
}

/** Maps an operator's wallet rows onto canonical wallet events. A real
 *  integration writes one small adapter like this per source file/feed. */
export class CsvWalletAdapter implements IngestionAdapter<RawWalletRow> {
  readonly id = 'csv-wallet'

  toCanonical(raw: RawWalletRow, _tenant: TenantContext): CanonicalEvent[] {
    const kind = TXN_KIND[raw.txn_type]
    if (!kind) return [] // unknown row types are skipped, not guessed
    return [
      {
        type: 'wallet',
        playerRef: raw.player_id, // tokenised upstream at the ingestion boundary
        ts: new Date(raw.processed_at).toISOString(),
        kind,
        amount: Number(raw.amount_eur) || 0,
        method: raw.method,
        status: TXN_STATUS[raw.status] ?? 'settled',
      },
    ]
  }
}

/** One row of a daily betting-summary export (matches how most operators batch
 *  betting activity — and the source research dataset's structure). */
export interface RawWagerRow {
  player_id: string
  date: string
  product: string
  game_speed: string
  bets: string
  stake_eur: string
  winnings_eur: string
  peak_stake_eur: string
}

const GAME_SPEED: Record<string, GameSpeed> = { slow: 'slow', medium: 'medium', fast: 'fast' }

export class CsvWagerAdapter implements IngestionAdapter<RawWagerRow> {
  readonly id = 'csv-wager'

  toCanonical(raw: RawWagerRow, _tenant: TenantContext): CanonicalEvent[] {
    const bets = Number(raw.bets) || 0
    if (bets <= 0) return []
    return [
      {
        type: 'wager',
        playerRef: raw.player_id,
        ts: new Date(raw.date).toISOString(),
        product: raw.product,
        gameSpeed: GAME_SPEED[raw.game_speed] ?? 'medium',
        stake: Number(raw.stake_eur) || 0,
        payout: Number(raw.winnings_eur) || 0,
        bets,
        peakStake: Number(raw.peak_stake_eur) || undefined,
      },
    ]
  }
}

/** One row of a session export. */
export interface RawSessionRow {
  player_id: string
  date: string
  duration_min: string
  night_fraction: string
}

export class CsvSessionAdapter implements IngestionAdapter<RawSessionRow> {
  readonly id = 'csv-session'

  toCanonical(raw: RawSessionRow, _tenant: TenantContext): CanonicalEvent[] {
    return [
      {
        type: 'session',
        playerRef: raw.player_id,
        ts: new Date(raw.date).toISOString(),
        durationMin: Number(raw.duration_min) || 0,
        nightFraction: Number(raw.night_fraction) || 0,
      },
    ]
  }
}

/** One row of a player/account export (reference data, not an event). */
export interface RawIdentityRow {
  player_id: string
  country: string
  jurisdiction: string
  age_band: string
  gender: string
  currency: string
  account_opened_at: string
}

/** Map an identity row onto a canonical IdentityRecord. */
export function identityFromRow(raw: RawIdentityRow): IdentityRecord {
  const gender = raw.gender === 'M' || raw.gender === 'F' ? raw.gender : 'X'
  return {
    playerRef: raw.player_id,
    country: raw.country,
    jurisdiction: raw.jurisdiction,
    ageBand: raw.age_band,
    gender,
    currency: raw.currency || 'EUR',
    accountOpenedAt: raw.account_opened_at,
  }
}
