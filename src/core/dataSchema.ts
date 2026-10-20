// ---------------------------------------------------------------------------
// THE DATA FORMAT — the authoritative CSV contract for bringing your own data.
//
// This single source drives: the downloadable templates, the in-app validator,
// the ingestion adapters, and the docs. Four files describe a player base:
// identities (who), wagers (daily betting), wallet (money in/out), sessions.
// Every row keys on `player_id`; amounts are in the operator's settlement
// currency (EUR here). Get it right and it flows straight to a risk score.
// ---------------------------------------------------------------------------

export type ColType = 'string' | 'number' | 'date' | 'enum'

export interface Column {
  name: string
  type: ColType
  required: boolean
  enumValues?: string[]
  example: string
  note?: string
}

export interface DatasetSchema {
  id: 'identities' | 'wagers' | 'wallet' | 'sessions'
  file: string
  label: string
  description: string
  /** Foreign key into identities (except identities itself, where it's the PK). */
  keyColumn: 'player_id'
  columns: Column[]
}

export const DATASETS: DatasetSchema[] = [
  {
    id: 'identities',
    file: 'identities.csv',
    label: 'Identities',
    description: 'One row per player account (the roster). Use a pseudonymous id — no PII.',
    keyColumn: 'player_id',
    columns: [
      { name: 'player_id', type: 'string', required: true, example: 'P-100001', note: 'Pseudonymous, stable, unique.' },
      { name: 'country', type: 'string', required: false, example: 'United Kingdom' },
      { name: 'jurisdiction', type: 'string', required: false, example: 'GB', note: 'ISO-2 / licence region.' },
      { name: 'age_band', type: 'string', required: false, example: '25-34' },
      { name: 'gender', type: 'enum', required: false, enumValues: ['M', 'F', 'X'], example: 'M' },
      { name: 'currency', type: 'string', required: false, example: 'EUR' },
      { name: 'account_opened_at', type: 'date', required: false, example: '2016-09-21', note: 'YYYY-MM-DD.' },
      { name: 'self_excluded', type: 'enum', required: false, enumValues: ['0', '1'], example: '0', note: 'Optional outcome label for calibrating the model to your population: 1 = later self-excluded / flagged for harm.' },
    ],
  },
  {
    id: 'wagers',
    file: 'wagers.csv',
    label: 'Wagers (daily)',
    description: 'Daily betting summary per player per day — one row per active day.',
    keyColumn: 'player_id',
    columns: [
      { name: 'player_id', type: 'string', required: true, example: 'P-100001' },
      { name: 'date', type: 'date', required: true, example: '2026-06-14', note: 'YYYY-MM-DD.' },
      { name: 'product', type: 'string', required: false, example: 'Sportsbook' },
      { name: 'game_speed', type: 'enum', required: false, enumValues: ['slow', 'medium', 'fast'], example: 'fast', note: 'Pace/volatility of the product.' },
      { name: 'bets', type: 'number', required: true, example: '42', note: 'Count of bets that day (> 0).' },
      { name: 'stake_eur', type: 'number', required: true, example: '210.50', note: 'Total turnover that day.' },
      { name: 'winnings_eur', type: 'number', required: true, example: '188.00', note: 'Total returned to the player.' },
      { name: 'peak_stake_eur', type: 'number', required: false, example: '25.00' },
    ],
  },
  {
    id: 'wallet',
    file: 'wallet.csv',
    label: 'Wallet',
    description: 'Money in/out — one row per deposit, withdrawal, or cancelled withdrawal.',
    keyColumn: 'player_id',
    columns: [
      { name: 'player_id', type: 'string', required: true, example: 'P-100001' },
      { name: 'processed_at', type: 'date', required: true, example: '2026-06-14', note: 'YYYY-MM-DD.' },
      { name: 'txn_type', type: 'enum', required: true, enumValues: ['DEP', 'WD', 'WD_CANCEL'], example: 'DEP', note: 'Deposit / withdrawal / cancelled withdrawal.' },
      { name: 'amount_eur', type: 'number', required: true, example: '50.00' },
      { name: 'method', type: 'string', required: false, example: 'Visa' },
      { name: 'status', type: 'enum', required: true, enumValues: ['S', 'F', 'R'], example: 'S', note: 'Settled / failed / reversed.' },
    ],
  },
  {
    id: 'sessions',
    file: 'sessions.csv',
    label: 'Sessions',
    description: 'Session-level play time — one row per session.',
    keyColumn: 'player_id',
    columns: [
      { name: 'player_id', type: 'string', required: true, example: 'P-100001' },
      { name: 'date', type: 'date', required: true, example: '2026-06-14' },
      { name: 'duration_min', type: 'number', required: true, example: '95' },
      { name: 'night_fraction', type: 'number', required: false, example: '0.4', note: '0–1 share between 00:00–06:00.' },
    ],
  },
]

export function datasetById(id: string): DatasetSchema | undefined {
  return DATASETS.find((d) => d.id === id)
}
