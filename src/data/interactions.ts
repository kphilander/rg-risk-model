// Synthetic staff interaction log — deterministic seed so the demo shows the
// qualitative signal folding into scores. Two shapes:
//   • corroboration — already-risky players with observations that match their
//     data profile (nudges the score via bounded uplift), and
//   • detection — a few LOW/MODERATE players with a self-disclosure or a
//     third-party concern, which floors them to Elevated: the log surfacing a
//     player the wagering data alone would miss.

import type { Interaction, PlayerProfile, RiskAssessment } from '../types'
import { makeRng } from '../lib/rng'
import {
  INTERACTION_METHODS,
  OBSERVED_MARKER_BY_SLUG,
  type InteractionKind,
  type InteractionMethod,
} from '../core/observedMarkers'

const OPERATORS = ['a.nielsen@operator.example', 'r.okafor@operator.example', 's.laurent@operator.example']

const CORROBORATING_MARKERS = [
  'chasing-losses', 'escalating-stakes', 'erratic-play', 'spend-spike',
  'withdrawal-reversal', 'session-length', 'late-night-play', 'frequency-spike',
  'distress', 'irritability', 'limit-evasion', 'failed-deposits',
]

const NOTE: Record<string, string> = {
  'chasing-losses': 'Increased stakes noticeably after a losing run — appeared to be trying to win it back.',
  'escalating-stakes': 'Average bet size has crept up well beyond their usual pattern.',
  'erratic-play': 'Jumped between games and stakes erratically this week.',
  'limit-evasion': 'Asked twice about raising deposit limits and mentioned a second payment card.',
  'spend-spike': 'Deposits stepped up sharply compared with their normal month.',
  'failed-deposits': 'Several declined deposit attempts in one session.',
  'withdrawal-reversal': 'Cancelled a pending withdrawal and put it straight back into play.',
  'session-length': 'Sessions running much longer than usual — one over four hours.',
  'late-night-play': 'Repeated overnight sessions in the early hours.',
  'frequency-spike': 'Playing most days now, up from a couple of times a week.',
  'distress': 'Appeared visibly frustrated and agitated after losses.',
  'self-disclosure': 'Player said they were worried about how much time and money they have been spending.',
  'irritability': 'Reacted sharply to a routine check-in prompt.',
  'third-party-concern': 'A family member contacted us with concerns about the player’s gambling.',
  'isolation': 'Mentioned they have been playing alone a lot and pulling back from friends.',
}

function primaryNote(markers: string[]): string {
  const primary = [...markers].sort(
    (a, b) => (OBSERVED_MARKER_BY_SLUG.get(b)?.weight ?? 0) - (OBSERVED_MARKER_BY_SLUG.get(a)?.weight ?? 0),
  )[0]
  return NOTE[primary] ?? 'Staff observation logged.'
}

function dataEnd(p: PlayerProfile): string {
  return p.activity[p.activity.length - 1]?.date ?? p.lastActive.slice(0, 10)
}

/** Build the seeded interaction log for the synthetic portfolio. */
export function seedInteractions(
  players: PlayerProfile[],
  assessments: Map<string, RiskAssessment>,
): Interaction[] {
  const rng = makeRng('rg-risk-interactions-v1')
  const out: Interaction[] = []
  let n = 0
  const at = (p: PlayerProfile, kind: InteractionKind, method: InteractionMethod, markers: string[]) => {
    const end = Date.parse(dataEnd(p))
    const ts = new Date(end - rng.int(2, 55) * 86_400_000).toISOString()
    out.push({
      id: `IX-${(n++).toString(36).padStart(4, '0')}`,
      playerId: p.id,
      timestamp: ts,
      kind,
      method,
      markers,
      note: primaryNote(markers),
      operator: rng.pick(OPERATORS),
    })
  }

  // Stable order so the seed is identical every load.
  const ranked = [...players]
    .map((p) => ({ p, score: assessments.get(p.id)?.score ?? 0 }))
    .sort((a, b) => (a.p.id < b.p.id ? -1 : 1))

  // Detection: a handful of low/moderate players get a critical disclosure.
  let detections = 0
  for (const { p, score } of ranked) {
    if (detections >= 5) break
    if (score >= 12 && score <= 42 && rng.bool(0.14)) {
      const thirdParty = rng.bool(0.4)
      at(
        p,
        thirdParty ? 'referral' : 'rg_conversation',
        thirdParty ? 'phone' : rng.pick(['in_person', 'chat'] as const),
        thirdParty ? ['third-party-concern'] : ['self-disclosure', ...(rng.bool(0.5) ? ['distress'] : [])],
      )
      detections++
    }
  }

  // Corroboration: observations on players the data already flags.
  for (const { p, score } of ranked) {
    const prob = score >= 70 ? 0.6 : score >= 55 ? 0.4 : score >= 45 ? 0.22 : 0
    if (prob === 0 || !rng.bool(prob)) continue
    const count = rng.int(1, score >= 70 ? 3 : 2)
    for (let k = 0; k < count; k++) {
      const kind = rng.pick(['observation', 'observation', 'rg_conversation', 'follow_up'] as const)
      const method = rng.pick(INTERACTION_METHODS)
      const m1 = rng.pick(CORROBORATING_MARKERS)
      const markers = rng.bool(0.5) ? [m1] : [m1, rng.pick(CORROBORATING_MARKERS)]
      at(p, kind, method, [...new Set(markers)])
    }
  }

  return out.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
}
