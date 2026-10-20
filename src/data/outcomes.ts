// Synthetic OUTCOME data for the efficacy + fairness features.
//   * harm labels  — a generative "true harm" flag per player (independent of the
//     score), so calibration and subgroup fairness can be measured honestly.
//   * intervention outcomes — a seeded history of past interventions with pre/post
//     risk, so intervention *effectiveness* can be shown (the missing feedback loop).
// All deterministic + synthetic. No real records.

import type { ArchetypeId, PlayerProfile, RiskAssessment } from '../types'
import { makeRng } from '../lib/rng'

// P(true harm | archetype) — the generative truth the model is meant to detect.
const HARM_PROB: Record<ArchetypeId, number> = {
  recreational: 0.03,
  regular: 0.12,
  rising: 0.42,
  highroller: 0.28,
  chaser: 0.68,
  critical: 0.9,
}

/** Deterministic "true harm" label per player (proxy ground truth for
 *  calibration + fairness — derived from archetype, NOT from the score). */
export function buildHarmLabels(players: PlayerProfile[]): Map<string, boolean> {
  const m = new Map<string, boolean>()
  for (const p of players) {
    const rng = makeRng(`${p.id}-harm`)
    m.set(p.id, rng.next() < (HARM_PROB[p.archetype] ?? 0.1))
  }
  return m
}

export interface InterventionOutcome {
  id: string
  playerId: string
  handle: string
  level: number
  preRisk: number
  postRisk: number
  /** Positive = risk fell after the intervention. */
  delta: number
  responded: boolean
  daysAgo: number
}

// Higher escalation levels are more effective on average (and more likely to land).
const RESPONSE_PROB: Record<number, number> = { 1: 0.16, 2: 0.32, 3: 0.52, 4: 0.68, 5: 0.81 }

/** Seeded history of past interventions with observed pre/post risk. */
export function buildInterventionOutcomes(
  players: PlayerProfile[],
  assessments: Map<string, RiskAssessment>,
): InterventionOutcome[] {
  const rng = makeRng('outcomes-v1')
  // Bias toward players who actually warranted action.
  const candidates = players
    .map((p) => ({ p, a: assessments.get(p.id) }))
    .filter((x): x is { p: PlayerProfile; a: RiskAssessment } => !!x.a && x.a.recommendedLevel >= 2)
    .sort((x, y) => y.a.score - x.a.score)
    .slice(0, 90)

  const out: InterventionOutcome[] = []
  for (const { p, a } of candidates) {
    if (rng.next() > 0.8) continue // not everyone has a past action
    const level = Math.max(1, Math.min(5, a.recommendedLevel + (rng.next() < 0.3 ? -1 : 0)))
    const preRisk = Math.max(20, Math.min(100, Math.round(a.score + rng.gauss() * 6)))
    const responded = rng.next() < (RESPONSE_PROB[level] ?? 0.4)
    const drop = responded
      ? 6 + level * 3 + Math.abs(rng.gauss()) * 6
      : rng.gauss() * 4 - 1 // non-responders: ~flat, sometimes worse
    const postRisk = Math.max(0, Math.min(100, Math.round(preRisk - drop)))
    out.push({
      id: `OUT-${p.id}`,
      playerId: p.id,
      handle: p.handle,
      level,
      preRisk,
      postRisk,
      delta: preRisk - postRisk,
      responded,
      daysAgo: 3 + Math.floor(rng.next() * 80),
    })
  }
  return out
}
