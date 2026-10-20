import type {
  DailyActivity,
  MarkerResult,
  PlayerProfile,
  RiskAssessment,
} from '../types'
import { bandForScore } from '../lib/riskBands'
import { DEFAULT_RISK_CONFIG, type RiskConfig } from '../core/config'
import { applyModel } from '../core/riskModel'
import { computeMarkers } from './markers'

/** Aggregate marker scores into a single 0-100 ordinal risk index — a
 *  non-negative (monotonic) weighted mean using the fitted marker weights.
 *  (Replaces the old hand-set 0.62·mean + 0.38·top3 blend, which was never
 *  fitted; concentration is now reflected in the fitted weights themselves.) */
export function aggregateScore(markers: MarkerResult[]): number {
  const totalWeight = markers.reduce((s, m) => s + m.weight, 0)
  const weightedMean =
    totalWeight > 0 ? markers.reduce((s, m) => s + m.score * m.weight, 0) / totalWeight : 0
  return Math.round(Math.max(0, Math.min(100, weightedMean)))
}

/** Score a trailing slice of a player's window (used for trend points). */
function scoreSlice(activity: DailyActivity[], config: RiskConfig): number {
  return aggregateScore(computeMarkers(activity, config.markerWeights))
}

const TREND_POINTS = 13
const TREND_WINDOW = 35

/** Coarse weekly trend across the window for sparklines and detail charts. */
function buildTrend(
  activity: DailyActivity[],
  config: RiskConfig,
): { date: string; score: number }[] {
  const n = activity.length
  const out: { date: string; score: number }[] = []
  for (let p = 0; p < TREND_POINTS; p++) {
    const end = Math.round(((p + 1) / TREND_POINTS) * (n - 1))
    const start = Math.max(0, end - TREND_WINDOW)
    const slice = activity.slice(start, end + 1)
    out.push({ date: activity[end].date, score: scoreSlice(slice, config) })
  }
  return out
}

/** Full assessment for a single player (markers, score, band, trend, level). */
export function assessPlayer(
  player: PlayerProfile,
  config: RiskConfig = DEFAULT_RISK_CONFIG,
): RiskAssessment {
  const markers = computeMarkers(player.activity, config.markerWeights)
  const { aggregate, probability } = applyModel(markers, config.model)
  const score = Math.round(aggregate)
  const band = bandForScore(score, config.bands)
  const topMarkers = [...markers].sort((a, b) => b.score * b.weight - a.score * a.weight).slice(0, 5)
  const trend = buildTrend(player.activity, config)
  const delta7d = trend.length >= 2 ? trend[trend.length - 1].score - trend[trend.length - 2].score : 0
  return {
    playerId: player.id,
    score,
    band,
    probability,
    markers,
    topMarkers,
    trend,
    recommendedLevel: config.escalation[band.id].level,
    peerPercentile: 0, // filled in by assessAll once the cohort is known
    delta7d,
  }
}

/** Denser per-2-day rolling trend for the player detail chart (computed on demand). */
export function denseTrend(
  player: PlayerProfile,
  config: RiskConfig = DEFAULT_RISK_CONFIG,
): { date: string; score: number }[] {
  const activity = player.activity
  const n = activity.length
  const out: { date: string; score: number }[] = []
  for (let end = 13; end < n; end += 2) {
    const start = Math.max(0, end - TREND_WINDOW)
    out.push({ date: activity[end].date, score: scoreSlice(activity.slice(start, end + 1), config) })
  }
  return out
}

/** Assess an entire portfolio and back-fill peer percentiles. */
export function assessAll(
  players: PlayerProfile[],
  config: RiskConfig = DEFAULT_RISK_CONFIG,
): Map<string, RiskAssessment> {
  const assessments = players.map((p) => assessPlayer(p, config))
  const sorted = [...assessments].map((a) => a.score).sort((a, b) => a - b)
  const map = new Map<string, RiskAssessment>()
  for (const a of assessments) {
    // Percentile = share of the cohort scoring at or below this player.
    const below = sorted.filter((s) => s <= a.score).length
    a.peerPercentile = Math.round((below / sorted.length) * 100)
    map.set(a.playerId, a)
  }
  return map
}

export interface PortfolioStats {
  totalPlayers: number
  activePlayers: number
  averageScore: number
  bandCounts: Record<string, number>
  /** Portfolio-wide average contribution of each marker, sorted desc. */
  topMarkers: { id: string; label: string; avg: number }[]
  /** Mean portfolio score per weekly trend point. */
  trend: { date: string; score: number }[]
  highRiskCount: number
}

export function portfolioStats(
  players: PlayerProfile[],
  assessments: Map<string, RiskAssessment>,
): PortfolioStats {
  const all = players.map((p) => assessments.get(p.id)!).filter(Boolean)
  const bandCounts: Record<string, number> = {
    low: 0,
    moderate: 0,
    elevated: 0,
    high: 0,
    critical: 0,
  }
  const markerTotals = new Map<string, { label: string; sum: number }>()
  const trendSums = new Array(TREND_POINTS).fill(0)
  let trendDates: string[] = []

  for (const a of all) {
    bandCounts[a.band.id]++
    for (const m of a.markers) {
      const entry = markerTotals.get(m.id) ?? { label: m.label, sum: 0 }
      entry.sum += m.score
      markerTotals.set(m.id, entry)
    }
    a.trend.forEach((t, i) => (trendSums[i] += t.score))
    if (a.trend.length === TREND_POINTS) trendDates = a.trend.map((t) => t.date)
  }

  const n = all.length || 1
  const topMarkers = [...markerTotals.entries()]
    .map(([id, v]) => ({ id, label: v.label, avg: v.sum / n }))
    .sort((a, b) => b.avg - a.avg)

  // "Active" = played within the most recent 14 days of the window.
  const activePlayers = players.filter((p) =>
    p.activity.slice(-14).some((d) => d.played),
  ).length

  // Only emit a trend when we have real, dated points (an empty portfolio —
  // e.g. before an async data source hydrates — yields no trend, not bad dates).
  const trend =
    trendDates.length === TREND_POINTS
      ? trendSums.map((s, i) => ({ date: trendDates[i], score: Math.round(s / n) }))
      : []

  return {
    totalPlayers: players.length,
    activePlayers,
    averageScore: all.length ? Math.round(all.reduce((s, a) => s + a.score, 0) / n) : 0,
    bandCounts,
    topMarkers,
    trend,
    highRiskCount: bandCounts.high + bandCounts.critical,
  }
}
