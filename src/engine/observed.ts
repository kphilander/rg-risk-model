// Observed-signal overlay — turns the staff interaction log into an INPUT
// VARIABLE for the risk model.
//
// The data-derived score (engine/scoring.ts) is the base. When a player has
// interactions we fold in two interpretable, bounded ways:
//   • uplift — corroboration that nudges the score up, weighted by INCREMENTAL
//     INFORMATION (an observation confirming a marker the data already scores
//     high adds almost nothing; a data-blind or data-disagreeing one adds full
//     weight), so watching a player closely can't by itself inflate their score.
//   • floor  — an OPEN critical disclosure (self-disclosure / third-party
//     concern) floors the band. The floor is standing: it does not decay by the
//     calendar, it clears only when a human logs a resolving follow-up. A
//     "no concern" follow-up additionally dampens corroboration (two-way ratchet).
// No interactions → the base score is returned unchanged (graceful degradation).

import type { Interaction, RiskAssessment } from '../types'
import { DEFAULT_RISK_CONFIG, type RiskConfig } from '../core/config'
import { bandForScore } from '../lib/riskBands'
import {
  KIND_WEIGHT,
  MARKER_CATEGORIES,
  OBSERVED_MARKER_BY_SLUG,
  type MarkerCategory,
  type ObservedContribution,
  type ObservedSignal,
} from '../core/observedMarkers'

const WINDOW_DAYS = 92 // rolling window for transient behavioural corroboration
const HALF_LIFE = 30 // recency half-life: a 30-day-old observation counts half
const UPLIFT_CAP = 18 // max points a full observed load can add to the data score
const SATURATION = 1.9 // load → 0-100 scaling (diminishing returns)
const CRITICAL_FLOOR = 50 // Elevated floor for an open critical disclosure
const INFO_FLOOR = 0.15 // corroboration never counts for literally nothing
const REASSURE_DAMPEN = 0.35 // a recent "no concern" follow-up shrinks corroboration

const DAY_MS = 86_400_000

function ageDays(fromISO: string, asOfISO: string): number {
  return (Date.parse(asOfISO) - Date.parse(fromISO)) / DAY_MS
}
function recency(age: number): number {
  return Math.pow(0.5, Math.max(0, age) / HALF_LIFE)
}
function emptyByCategory(): Record<MarkerCategory, number> {
  return { behavioural: 0, financial: 0, time: 0, emotional: 0, social: 0 }
}
/** Incremental-information factor: full when data-blind or the data score is low
 *  (the observation disagrees / fills a blind spot), →0 as the data already flags it. */
function infoFactor(dataScore: number | undefined): number {
  if (dataScore == null) return 1
  return Math.max(INFO_FLOOR, Math.min(1, 1 - dataScore / 100))
}

const EMPTY_SIGNAL: ObservedSignal = {
  score: 0, uplift: 0, floor: 0, count: 0, lastAt: null,
  top: [], byCategory: emptyByCategory(), hasCritical: false, concern: 'none', reassured: false,
}

/** Compute the observed-risk signal for one player's interaction log.
 *  `dataScores` maps data-marker id → 0-100 score so corroboration can be
 *  weighted by how much new information the observation actually adds. */
export function observedSignal(
  interactions: Interaction[],
  asOf: string,
  dataScores?: Map<string, number>,
): ObservedSignal {
  if (interactions.length === 0) return EMPTY_SIGNAL

  const byTime = [...interactions].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
  const mostRecent = byTime[0]

  // ── Standing concern (floor) — scans ALL interactions, no calendar decay ──
  let latestCritical: string | null = null
  for (const it of interactions) {
    if (it.markers.some((s) => OBSERVED_MARKER_BY_SLUG.get(s)?.critical)) {
      if (!latestCritical || it.timestamp > latestCritical) latestCritical = it.timestamp
    }
  }
  let concern: ObservedSignal['concern'] = 'none'
  if (latestCritical) {
    const closed = interactions.some(
      (it) =>
        it.kind === 'follow_up' &&
        (it.outcome === 'resolved' || it.outcome === 'no_concern') &&
        it.timestamp > latestCritical!,
    )
    concern = closed ? 'resolved' : 'open'
  }
  const floor = concern === 'open' ? CRITICAL_FLOOR : 0

  // ── Corroboration (uplift) — windowed, recency- and info-weighted ──
  const reassured = mostRecent.kind === 'follow_up' && mostRecent.outcome === 'no_concern'
  const windowed = interactions.filter((i) => {
    const a = ageDays(i.timestamp, asOf)
    return a >= -1 && a <= WINDOW_DAYS
  })
  const byMarker = new Map<string, ObservedContribution>()
  const byCategory = emptyByCategory()
  let load = 0
  let lastAt: string | null = null

  for (const it of windowed) {
    const rec = recency(ageDays(it.timestamp, asOf))
    const kindW = KIND_WEIGHT[it.kind] ?? 0.6
    if (!lastAt || it.timestamp > lastAt) lastAt = it.timestamp
    for (const slug of it.markers) {
      const m = OBSERVED_MARKER_BY_SLUG.get(slug)
      if (!m) continue
      const info = infoFactor(m.dataMarker ? dataScores?.get(m.dataMarker) : undefined)
      const contribution = m.weight * kindW * rec * info
      load += contribution
      byCategory[m.category] += contribution
      const prev = byMarker.get(slug)
      if (!prev || contribution > prev.contribution) {
        byMarker.set(slug, { slug, label: m.label, category: m.category, weight: m.weight, recency: rec, info, contribution })
      }
    }
  }
  if (reassured) load *= REASSURE_DAMPEN

  const score = Math.round(100 * (1 - Math.exp(-load / SATURATION)))
  const uplift = Math.round(UPLIFT_CAP * (score / 100))
  const top = [...byMarker.values()].sort((a, b) => b.contribution - a.contribution).slice(0, 5)

  return {
    score, uplift, floor, count: windowed.length, lastAt: lastAt ?? mostRecent.timestamp,
    top, byCategory, hasCritical: latestCritical != null, concern, reassured,
  }
}

/** Fold a player's interaction log into their data-derived assessment. */
export function foldObserved(
  base: RiskAssessment,
  interactions: Interaction[],
  asOf: string,
  config: RiskConfig = DEFAULT_RISK_CONFIG,
): RiskAssessment {
  if (interactions.length === 0) return base
  const dataScores = new Map(base.markers.map((m) => [m.id, m.score]))
  const signal = observedSignal(interactions, asOf, dataScores)
  const combined = Math.max(0, Math.min(100, Math.max(base.score + signal.uplift, signal.floor)))
  const band = bandForScore(combined, config.bands)
  return {
    ...base,
    dataScore: base.score,
    score: combined,
    observed: signal,
    band,
    recommendedLevel: config.escalation[band.id].level,
  }
}

/** Apply the overlay across a portfolio, returning a new assessments map with
 *  peer percentiles recomputed over the COMBINED scores. A single global
 *  "as-of" (the latest date in the system) keeps recency consistent and lets a
 *  just-logged interaction count as fully recent. */
export function foldObservedAll(
  players: { id: string; activity: { date: string }[] }[],
  base: Map<string, RiskAssessment>,
  interactions: Interaction[],
  config: RiskConfig = DEFAULT_RISK_CONFIG,
): Map<string, RiskAssessment> {
  if (interactions.length === 0) return base

  let asOf = ''
  for (const p of players) {
    const d = p.activity[p.activity.length - 1]?.date
    if (d && d > asOf) asOf = d
  }
  for (const it of interactions) {
    const d = it.timestamp.slice(0, 10)
    if (d > asOf) asOf = d
  }
  if (!asOf) asOf = new Date().toISOString().slice(0, 10)

  const byPlayer = new Map<string, Interaction[]>()
  for (const it of interactions) {
    const list = byPlayer.get(it.playerId)
    if (list) list.push(it)
    else byPlayer.set(it.playerId, [it])
  }

  const folded = new Map(base)
  for (const [pid, list] of byPlayer) {
    const b = base.get(pid)
    if (b) folded.set(pid, foldObserved(b, list, asOf, config))
  }

  // Recompute peer percentiles over combined scores; copy every entry so the
  // pristine base map is never mutated (it's reused for the next re-fold).
  const sorted = [...folded.values()].map((a) => a.score).sort((x, y) => x - y)
  const n = sorted.length || 1
  const out = new Map<string, RiskAssessment>()
  for (const [id, a] of folded) {
    const below = sorted.filter((s) => s <= a.score).length
    out.set(id, { ...a, peerPercentile: Math.round((below / n) * 100) })
  }
  return out
}

export { MARKER_CATEGORIES }
