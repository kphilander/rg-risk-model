// Counterfactual explanations — the minimal set of marker reductions that would
// move a player DOWN a risk band. Only an interpretable, additive model can
// answer "what would have to change" honestly; this greedily relaxes the
// highest-contributing markers until the aggregate score crosses the threshold.

import type { MarkerResult, RiskBand } from '../types'
import { RISK_BANDS, bandForScore } from '../lib/riskBands'
import { aggregateScore } from './scoring'

export interface MarkerChange {
  id: string
  label: string
  from: number
  to: number
  delta: number
}

export interface Counterfactual {
  targetBand: RiskBand
  threshold: number
  finalScore: number
  changes: MarkerChange[]
  achievable: boolean
}

const STEP = 3
const MAX_ITERS = 600

/** Minimal marker reductions to drop `markers` below the current band.
 *  Returns null if the player is already in the lowest band. */
export function counterfactual(markers: MarkerResult[], currentScore: number): Counterfactual | null {
  const idx = RISK_BANDS.findIndex((b) => b.id === bandForScore(currentScore).id)
  if (idx <= 0) return null // already Low — nothing to lower

  const targetBand = RISK_BANDS[idx - 1]
  const threshold = targetBand.max

  const work = markers.map((m) => ({ ...m }))
  const original = new Map(markers.map((m) => [m.id, m.score]))

  let iters = 0
  while (aggregateScore(work) > threshold && iters++ < MAX_ITERS) {
    // Relax the marker with the largest weighted contribution that can still move.
    let best = -1
    let bestContribution = -Infinity
    for (let i = 0; i < work.length; i++) {
      if (work[i].score <= 0) continue
      const contribution = work[i].score * work[i].weight
      if (contribution > bestContribution) {
        bestContribution = contribution
        best = i
      }
    }
    if (best < 0) break
    work[best].score = Math.max(0, work[best].score - STEP)
  }

  const finalScore = aggregateScore(work)
  const changes: MarkerChange[] = work
    .map((m) => {
      const from = Math.round(original.get(m.id) ?? 0)
      const to = Math.round(m.score)
      return { id: m.id, label: m.label, from, to, delta: from - to }
    })
    .filter((c) => c.delta > 0)
    .sort((a, b) => b.delta - a.delta)

  return { targetBand, threshold, finalScore, changes, achievable: finalScore <= threshold }
}
