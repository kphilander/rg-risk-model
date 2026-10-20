// Column mapping — the thing that lets an RG analyst import their operator's
// real export without renaming a single column in Excel. We parse whatever
// headers they have, auto-suggest which one feeds each canonical field, let them
// confirm/adjust, then REMAP their rows onto the canonical schema (+ coerce the
// common enum spellings). The rest of the pipeline (validate → score) is unchanged.

import type { DatasetSchema } from '../core/dataSchema'
import type { ParsedCsv } from './dataImport'

/** A mapping: canonical column name → the source header that feeds it (or null). */
export type ColumnMapping = Record<string, string | null>

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

// Header aliases per canonical column — the names operators actually use.
const ALIASES: Record<string, string[]> = {
  player_id: ['playerid', 'customerid', 'customerref', 'customer', 'userid', 'accountid', 'account', 'punterid', 'memberid', 'id', 'player', 'uid'],
  country: ['country', 'nation', 'residencecountry', 'countrycode'],
  jurisdiction: ['jurisdiction', 'licence', 'license', 'region', 'market', 'licenseregion', 'regulator'],
  age_band: ['ageband', 'agegroup', 'age'],
  gender: ['gender', 'sex'],
  currency: ['currency', 'ccy', 'settlementcurrency'],
  account_opened_at: ['accountopenedat', 'opened', 'registrationdate', 'regdate', 'signupdate', 'createdat', 'accountcreated', 'joindate'],
  date: ['date', 'activitydate', 'playdate', 'summarydate', 'betdate', 'gamingdate', 'day'],
  product: ['product', 'vertical', 'gametype', 'category', 'producttype', 'gamename'],
  game_speed: ['gamespeed', 'speed', 'pace', 'volatility', 'gamepace'],
  bets: ['bets', 'betcount', 'numbets', 'numberofbets', 'nbets', 'rounds', 'plays'],
  stake_eur: ['stakeeur', 'stake', 'totalstake', 'turnover', 'wagered', 'amountstaked', 'stakes', 'betamount', 'totalbet'],
  winnings_eur: ['winningseur', 'winnings', 'payout', 'returns', 'won', 'returned', 'wins', 'payoutamount'],
  peak_stake_eur: ['peakstakeeur', 'peakstake', 'maxstake', 'higheststake', 'maxbet'],
  processed_at: ['processedat', 'date', 'txndate', 'transactiondate', 'summarydate', 'processed', 'timestamp'],
  txn_type: ['txntype', 'type', 'transactiontype', 'direction', 'movementtype', 'category'],
  amount_eur: ['amounteur', 'amount', 'value', 'txnamount', 'transactionamount', 'sum'],
  method: ['method', 'paymentmethod', 'paymenttype', 'instrument', 'channel'],
  status: ['status', 'txnstatus', 'transactionstatus', 'state', 'result'],
  duration_min: ['durationmin', 'duration', 'sessionlength', 'minutes', 'lengthmin', 'durationminutes', 'playtime'],
  night_fraction: ['nightfraction', 'overnightshare', 'nightshare', 'latenightfraction', 'overnight'],
  self_excluded: ['selfexcluded', 'selfexclusion', 'excluded', 'harm', 'harmed', 'outcome', 'label', 'flag', 'atrisk', 'problemgambler'],
}

// Value coercion for enum columns — map the common spellings onto our codes.
const ENUM_COERCE: Record<string, (v: string) => string> = {
  gender: (v) => {
    const n = norm(v)
    if (n === 'm' || n === 'male' || n === 'man') return 'M'
    if (n === 'f' || n === 'female' || n === 'woman') return 'F'
    if (n) return 'X'
    return v
  },
  game_speed: (v) => {
    const n = norm(v)
    if (['slow', 'low'].includes(n)) return 'slow'
    if (['medium', 'med', 'mid', 'moderate'].includes(n)) return 'medium'
    if (['fast', 'turbo', 'high', 'rapid'].includes(n)) return 'fast'
    return v.toLowerCase()
  },
  txn_type: (v) => {
    const n = norm(v)
    if (['dep', 'deposit', 'deposits', 'credit', 'topup', 'cr', 'in', 'depositin'].includes(n)) return 'DEP'
    if (['wd', 'withdrawal', 'withdraw', 'withdrawals', 'cashout', 'payout', 'debit', 'dr', 'out'].includes(n)) return 'WD'
    if (['wdcancel', 'cancel', 'cancelled', 'canceled', 'reversal', 'reversedwithdrawal', 'withdrawalcancel', 'cancelledwithdrawal'].includes(n)) return 'WD_CANCEL'
    return v.toUpperCase()
  },
  status: (v) => {
    const n = norm(v)
    if (['s', 'settled', 'success', 'successful', 'ok', 'complete', 'completed', 'approved', 'paid', 'done'].includes(n)) return 'S'
    if (['f', 'failed', 'fail', 'declined', 'rejected', 'error', 'insufficientfunds'].includes(n)) return 'F'
    if (['r', 'reversed', 'reversal', 'cancelled', 'canceled', 'returned', 'chargeback'].includes(n)) return 'R'
    return v.toUpperCase()
  },
  // Outcome label → normalise truthy/falsy to 1/0 for calibration.
  self_excluded: (v) => {
    const n = norm(v)
    if (['1', 'true', 'yes', 'y', 't', 'excluded', 'selfexcluded', 'harm', 'harmed'].includes(n)) return '1'
    if (['0', 'false', 'no', 'n', 'f', ''].includes(n)) return '0'
    return v
  },
}

/** Auto-suggest a mapping from the file's headers to the schema's canonical
 *  columns (exact-normalised match > alias match). Unmatched → null. */
export function suggestMapping(schema: DatasetSchema, header: string[]): ColumnMapping {
  const normed = header.map((h) => ({ raw: h, n: norm(h) }))
  const used = new Set<string>()
  const out: ColumnMapping = {}
  for (const col of schema.columns) {
    const target = norm(col.name)
    const aliases = ALIASES[col.name] ?? []
    // 1) exact normalised name match, 2) alias match, 3) alias substring.
    let hit =
      normed.find((h) => !used.has(h.raw) && h.n === target) ||
      normed.find((h) => !used.has(h.raw) && aliases.includes(h.n)) ||
      normed.find((h) => !used.has(h.raw) && aliases.some((a) => h.n === a || h.n.includes(a) || a.includes(h.n)))
    out[col.name] = hit ? hit.raw : null
    if (hit) used.add(hit.raw)
  }
  return out
}

/** Coerce a value for a canonical column (enum spellings → codes; else trim). */
export function coerceValue(colName: string, value: string): string {
  const fn = ENUM_COERCE[colName]
  return fn ? fn(value.trim()) : value.trim()
}

/** Remap parsed rows onto the schema's canonical column names using a mapping,
 *  coercing enum/label values. The result validates + scores like a native file. */
export function remap(schema: DatasetSchema, parsed: ParsedCsv, mapping: ColumnMapping): ParsedCsv {
  const cols = schema.columns.map((c) => c.name)
  const header = cols.filter((c) => mapping[c])
  const rows = parsed.rows.map((r) => {
    const o: Record<string, string> = {}
    for (const c of cols) {
      const src = mapping[c]
      if (src) o[c] = coerceValue(c, r[src] ?? '')
    }
    return o
  })
  return { header, rows }
}

/** How complete is a mapping — required fields covered, and the total mapped. */
export function mappingStatus(schema: DatasetSchema, mapping: ColumnMapping) {
  const missingRequired = schema.columns.filter((c) => c.required && !mapping[c.name]).map((c) => c.name)
  const mapped = schema.columns.filter((c) => mapping[c.name]).length
  return { ok: missingRequired.length === 0, missingRequired, mapped, total: schema.columns.length }
}
