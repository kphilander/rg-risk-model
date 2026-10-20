import type { PlayerProfile, RiskAssessment } from '../types'
import { ESCALATION } from '../lib/riskBands'
import { observedMarker } from '../core/observedMarkers'

/**
 * Produce a short, explainable-AI style narrative for a player's risk profile.
 * Deterministic and derived from the computed markers PLUS the staff-observation
 * overlay — the explanation must attribute the shipped (combined) score to the
 * right layer, never crediting data markers for a score the interaction log drove.
 */
export function riskNarrative(player: PlayerProfile, a: RiskAssessment): string {
  const drivers = a.markers.filter((m) => m.score >= 35).sort((x, y) => y.score - x.score)
  const band = a.band.label.toLowerCase()
  const escalation = ESCALATION[a.band.id]
  const dataScore = a.dataScore ?? a.score
  const obs = a.observed

  // The staff-observation clause, attributed honestly to the overlay.
  const observedClause = (): string => {
    if (!obs) return ''
    if (obs.concern === 'open') {
      const crit = obs.top.find((t) => observedMarker(t.slug)?.critical)?.label.toLowerCase() ?? 'a disclosed concern'
      return ` Staff logged ${crit}, which holds the player at ${band} pending follow-up — independent of the data-derived score.`
    }
    if (obs.uplift > 0) {
      return ` Staff observations corroborate the data (+${obs.uplift}), lifting the data-derived ${dataScore} to ${a.score}.`
    }
    if (obs.concern === 'resolved') {
      return ` A prior staff concern was logged and closed out on follow-up.`
    }
    return ''
  }

  // Quiet data: recreational play, unless the interaction log moved the score.
  if (dataScore < 20 || drivers.length === 0) {
    if (obs && (obs.concern === 'open' || obs.uplift > 0)) {
      return (
        `${player.handle}'s wagering data shows well-controlled play (data-derived risk ${dataScore}/100), ` +
        `but staff observations change the assessment.${observedClause()} ` +
        `Recommended next step: ${escalation.action.toLowerCase()} — ${escalation.detail}`
      )
    }
    return `${player.handle} shows recreational, well-controlled play with no markers of concern. Risk is ${band} (${a.score}/100); routine automated monitoring is sufficient.`
  }

  const lead = drivers.slice(0, 2).map((m) => m.label.toLowerCase())
  const support = drivers.slice(2, 4).map((m) => m.label.toLowerCase())

  const parts: string[] = []
  parts.push(
    `${player.handle} scores ${a.score}/100 (${band} risk, ${a.peerPercentile}th percentile of the portfolio).`,
  )
  parts.push(
    `The data-derived score is driven chiefly by ${joinList(lead)}${
      support.length ? `, reinforced by ${joinList(support)}` : ''
    }.`,
  )
  if (a.delta7d >= 4) {
    parts.push(`Risk is trending up (+${a.delta7d} over the last week).`)
  } else if (a.delta7d <= -4) {
    parts.push(`Risk has eased recently (${a.delta7d} over the last week).`)
  }
  const oc = observedClause()
  if (oc) parts.push(oc.trim())
  parts.push(`Recommended next step: ${escalation.action.toLowerCase()} — ${escalation.detail}`)
  return parts.join(' ')
}

function joinList(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}
