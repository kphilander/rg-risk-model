// Fairness & calibration analytics — pure, deterministic functions over the
// synthetic portfolio. Nothing here mutates the store; every figure is derived
// from player demographics, the model's score/band, and the synthetic
// `buildHarmLabels` proxy ground-truth. Kept framework-free so it can be unit
// tested and reasoned about independently of the React layer.

import type { Interaction, PlayerProfile, RiskAssessment } from '../types'
import { RISK_BANDS, bandForScore } from './riskBands'

/** A player is "flagged" when the model scores them High or Critical (>= 60). */
export const FLAG_THRESHOLD = 60

/** Subgroups smaller than this are marked low-confidence in the UI. */
export const SMALL_N = 30

export type Dimension = 'gender' | 'ageBand' | 'jurisdiction'

/** One player joined to its assessment and synthetic harm label. */
export interface FairnessRow {
  player: PlayerProfile
  score: number
  flagged: boolean
  harmed: boolean
}

/** Safe division: returns 0 when the denominator is 0 (empty subgroup). */
export function safeRate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator
}

const GENDER_LABELS: Record<string, string> = { M: 'Male', F: 'Female', X: 'Non-binary / other' }

/** Human-readable label for a subgroup key on a given dimension. */
export function groupLabel(dim: Dimension, key: string): string {
  if (dim === 'gender') return GENDER_LABELS[key] ?? key
  return key
}

/** Join players → their assessment score/flag and harm label into flat rows. */
export function buildRows(
  players: PlayerProfile[],
  assessments: Map<string, RiskAssessment>,
  harm: Map<string, boolean>,
): FairnessRow[] {
  const rows: FairnessRow[] = []
  for (const player of players) {
    const a = assessments.get(player.id)
    if (!a) continue
    rows.push({
      player,
      score: a.score,
      flagged: a.score >= FLAG_THRESHOLD,
      harmed: harm.get(player.id) === true,
    })
  }
  return rows
}

/** Bucket the value of the selected dimension for one player. */
function keyFor(row: FairnessRow, dim: Dimension): string {
  return row.player[dim]
}

export interface SubgroupStat {
  key: string
  label: string
  n: number
  /** Count flagged (score >= 60). */
  flagged: number
  /** % of the subgroup flagged. */
  flagRate: number
  /** Count with harmLabel = true. */
  harmed: number
  /** % of the subgroup that is truly harmed (base rate). */
  harmRate: number
  /** Among truly-harmed members, count that were flagged. */
  harmedFlagged: number
  /** Recall / equal-opportunity: P(flagged | harmed). */
  recall: number
  /** Whether the subgroup is below the small-n confidence threshold. */
  smallN: boolean
}

/** Per-subgroup flag rate, harm base rate, and recall for one dimension. */
export function subgroupStats(rows: FairnessRow[], dim: Dimension): SubgroupStat[] {
  const groups = new Map<string, FairnessRow[]>()
  for (const row of rows) {
    const k = keyFor(row, dim)
    const arr = groups.get(k)
    if (arr) arr.push(row)
    else groups.set(k, [row])
  }

  const stats: SubgroupStat[] = []
  for (const [key, members] of groups) {
    const n = members.length
    const flagged = members.filter((m) => m.flagged).length
    const harmedRows = members.filter((m) => m.harmed)
    const harmed = harmedRows.length
    const harmedFlagged = harmedRows.filter((m) => m.flagged).length
    stats.push({
      key,
      label: groupLabel(dim, key),
      n,
      flagged,
      flagRate: safeRate(flagged, n),
      harmed,
      harmRate: safeRate(harmed, n),
      harmedFlagged,
      recall: safeRate(harmedFlagged, harmed),
      smallN: n < SMALL_N,
    })
  }

  // Order: gender + ageBand keep their natural label order; jurisdiction by size.
  if (dim === 'jurisdiction') {
    stats.sort((a, b) => b.n - a.n)
  } else {
    stats.sort((a, b) => a.key.localeCompare(b.key))
  }
  return stats
}

export interface DisparitySummary {
  spread: number
  maxGroup: SubgroupStat | null
  minGroup: SubgroupStat | null
}

/** Largest flag-rate disparity (max − min) across subgroups with adequate n.
 *  Falls back to all subgroups if fewer than two clear the small-n bar. */
export function flagRateDisparity(stats: SubgroupStat[]): DisparitySummary {
  const eligible = stats.filter((s) => !s.smallN)
  const pool = eligible.length >= 2 ? eligible : stats
  if (pool.length < 2) return { spread: 0, maxGroup: pool[0] ?? null, minGroup: pool[0] ?? null }
  let max = pool[0]
  let min = pool[0]
  for (const s of pool) {
    if (s.flagRate > max.flagRate) max = s
    if (s.flagRate < min.flagRate) min = s
  }
  return { spread: max.flagRate - min.flagRate, maxGroup: max, minGroup: min }
}

export interface CalibrationPoint {
  bandId: string
  bandLabel: string
  color: string
  /** Players the model placed in this band. */
  n: number
  /** Observed harm rate (from harmLabels) among that band. */
  harmRate: number
}

/** Observed harm rate per predicted band — the core calibration curve.
 *  A well-calibrated model produces a monotonically increasing curve. */
export function calibrationByBand(rows: FairnessRow[]): CalibrationPoint[] {
  return RISK_BANDS.map((band) => {
    const inBand = rows.filter((r) => bandForScore(r.score).id === band.id)
    const harmed = inBand.filter((r) => r.harmed).length
    return {
      bandId: band.id,
      bandLabel: band.label,
      color: band.color,
      n: inBand.length,
      harmRate: safeRate(harmed, inBand.length),
    }
  })
}

/** Calibration curves for a few subgroups of a dimension (largest first),
 *  shaped for a grouped bar chart: one row per band, one key per group. */
export interface GroupCalibrationSeries {
  groups: { key: string; label: string; n: number }[]
  /** One entry per band; `rates[groupKey]` = observed harm rate in that cell. */
  data: { bandId: string; bandLabel: string; color: string; rates: Record<string, number> }[]
}

export function calibrationByGroup(
  rows: FairnessRow[],
  dim: Dimension,
  maxGroups = 3,
): GroupCalibrationSeries {
  const stats = subgroupStats(rows, dim)
  // Prefer the largest subgroups so the per-band cells aren't dominated by noise.
  const chosen = [...stats].sort((a, b) => b.n - a.n).slice(0, maxGroups)
  const groups = chosen.map((g) => ({ key: g.key, label: g.label, n: g.n }))

  const data = RISK_BANDS.map((band) => {
    const rates: Record<string, number> = {}
    for (const g of chosen) {
      const cell = rows.filter(
        (r) => r.player[dim] === g.key && bandForScore(r.score).id === band.id,
      )
      const harmed = cell.filter((r) => r.harmed).length
      rates[g.key] = safeRate(harmed, cell.length)
    }
    return { bandId: band.id, bandLabel: band.label, color: band.color, rates }
  })

  return { groups, data }
}

/** Is the calibration curve monotonically non-decreasing across non-empty bands? */
export function isMonotonic(points: CalibrationPoint[]): boolean {
  const nonEmpty = points.filter((p) => p.n > 0)
  for (let i = 1; i < nonEmpty.length; i++) {
    if (nonEmpty[i].harmRate < nonEmpty[i - 1].harmRate - 1e-9) return false
  }
  return true
}

export interface OverallStats {
  n: number
  flagged: number
  harmed: number
  /** Portfolio recall: P(flagged | harmed). */
  recall: number
  /** Portfolio precision: P(harmed | flagged). */
  precision: number
  lowBandHarmRate: number
  criticalBandHarmRate: number
}

/** Portfolio-wide flag/harm/recall summary + the calibration endpoints. */
export function overallStats(rows: FairnessRow[], calibration: CalibrationPoint[]): OverallStats {
  const n = rows.length
  const flaggedRows = rows.filter((r) => r.flagged)
  const harmedRows = rows.filter((r) => r.harmed)
  const harmedFlagged = harmedRows.filter((r) => r.flagged).length
  const flaggedHarmed = flaggedRows.filter((r) => r.harmed).length
  const low = calibration.find((c) => c.bandId === 'low')
  const critical = calibration.find((c) => c.bandId === 'critical')
  return {
    n,
    flagged: flaggedRows.length,
    harmed: harmedRows.length,
    recall: safeRate(harmedFlagged, harmedRows.length),
    precision: safeRate(flaggedHarmed, flaggedRows.length),
    lowBandHarmRate: low?.harmRate ?? 0,
    criticalBandHarmRate: critical?.harmRate ?? 0,
  }
}

// ── Observation-channel fairness ─────────────────────────────────────────────
// "Who staff choose to observe" is the most discretionary input in the system:
// the interaction log folds qualitative human attention into the score, so any
// bias in *which* subgroups get watched, uplifted, or floored is a bias vector.
// These figures audit that channel per subgroup, alongside the model metrics.

export interface ObservationStat {
  key: string
  label: string
  n: number
  /** Members with >= 1 interaction in the log. */
  observed: number
  /** % of the subgroup with >= 1 logged interaction. */
  observationRate: number
  /** Mean observed uplift (points the overlay added) across the whole subgroup. */
  meanUplift: number
  /** Members whose overlay is holding an OPEN disclosure floor. */
  floored: number
  /** % of the subgroup carrying an open disclosure floor. */
  floorRate: number
  /** Whether the subgroup is below the small-n confidence threshold. */
  smallN: boolean
}

/** Per-subgroup observation rate, mean overlay uplift, and disclosure-floor rate
 *  for one dimension — a fairness view of the discretionary staff-attention
 *  channel. Deterministic: derived only from players, assessments and the log. */
export function observationChannelStats(
  players: PlayerProfile[],
  assessments: Map<string, RiskAssessment>,
  interactions: Interaction[],
  dim: Dimension,
): ObservationStat[] {
  // Which players have at least one interaction logged.
  const observedPlayers = new Set<string>()
  for (const it of interactions) observedPlayers.add(it.playerId)

  const groups = new Map<string, PlayerProfile[]>()
  for (const player of players) {
    const k = player[dim]
    const arr = groups.get(k)
    if (arr) arr.push(player)
    else groups.set(k, [player])
  }

  const stats: ObservationStat[] = []
  for (const [key, members] of groups) {
    const n = members.length
    let observed = 0
    let floored = 0
    let upliftSum = 0
    for (const p of members) {
      if (observedPlayers.has(p.id)) observed++
      const obs = assessments.get(p.id)?.observed
      upliftSum += obs?.uplift ?? 0
      if (obs?.concern === 'open') floored++
    }
    stats.push({
      key,
      label: groupLabel(dim, key),
      n,
      observed,
      observationRate: safeRate(observed, n),
      meanUplift: safeRate(upliftSum, n),
      floored,
      floorRate: safeRate(floored, n),
      smallN: n < SMALL_N,
    })
  }

  // Match subgroupStats ordering: jurisdiction by size, others by label.
  if (dim === 'jurisdiction') {
    stats.sort((a, b) => b.n - a.n)
  } else {
    stats.sort((a, b) => a.key.localeCompare(b.key))
  }
  return stats
}

export interface ObservationDisparity {
  /** max − min observation rate across eligible subgroups (parity gap). */
  spread: number
  /** max ÷ min observation rate (>= 1); Infinity if the min is 0. */
  ratio: number
  maxGroup: ObservationStat | null
  minGroup: ObservationStat | null
}

/** Largest observation-rate disparity across subgroups with adequate n.
 *  Falls back to all subgroups if fewer than two clear the small-n bar —
 *  mirrors flagRateDisparity so the two read identically in the UI. */
export function observationRateDisparity(stats: ObservationStat[]): ObservationDisparity {
  const eligible = stats.filter((s) => !s.smallN)
  const pool = eligible.length >= 2 ? eligible : stats
  if (pool.length < 2) {
    return { spread: 0, ratio: 1, maxGroup: pool[0] ?? null, minGroup: pool[0] ?? null }
  }
  let max = pool[0]
  let min = pool[0]
  for (const s of pool) {
    if (s.observationRate > max.observationRate) max = s
    if (s.observationRate < min.observationRate) min = s
  }
  const ratio = min.observationRate === 0 ? Infinity : max.observationRate / min.observationRate
  return { spread: max.observationRate - min.observationRate, ratio, maxGroup: max, minGroup: min }
}

/** Format a 0..1 rate as a whole-number percent string. */
export function pct(rate: number, digits = 0): string {
  return `${(rate * 100).toFixed(digits)}%`
}
