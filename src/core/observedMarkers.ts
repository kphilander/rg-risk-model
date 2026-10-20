// Staff-observed player-health markers — the qualitative signal recorded during
// a human interaction (an observation, a player-health conversation, an
// intervention). Adapted from an RG operator-tools marker module so the
// two products share one taxonomy.
//
// These are COMPLEMENTARY to the 13 data-derived markers in markers.ts. Each
// observed marker declares its `dataMarker` analog (or none) so the risk engine
// can weight it by INCREMENTAL INFORMATION: an observation that merely confirms
// a marker the data already scores high adds almost nothing (and never inflates
// scores just because a venue watches closely); one with no data analog
// (emotional / social / limit-evasion) — or one that DISAGREES with low data —
// carries full weight. See engine/observed.ts.

export const MARKER_CATEGORIES = ['behavioural', 'financial', 'time', 'emotional', 'social'] as const
export type MarkerCategory = (typeof MARKER_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<MarkerCategory, string> = {
  behavioural: 'Behavioural',
  financial: 'Financial',
  time: 'Time',
  emotional: 'Emotional',
  social: 'Social',
}

// Categorical hues, kept clear of the risk-band/tier palette (a dot answers
// "which category", never "how severe").
export const CATEGORY_COLOR: Record<MarkerCategory, string> = {
  behavioural: '#3e6488',
  financial: '#7a8fa6',
  time: '#a9b6c3',
  emotional: '#ff6482',
  social: '#f5a623',
}

export interface ObservedMarker {
  slug: string
  label: string
  category: MarkerCategory
  description: string
  /** Signal strength for risk (0-1) — how strongly observing this should move the score. */
  weight: number
  /** The data-derived marker id (markers.ts) this observation corroborates, if any.
   *  Undefined = data-blind: the data cannot see this, so it always carries full weight. */
  dataMarker?: string
  /** A high-confidence disclosure that should independently floor the risk band. */
  critical?: boolean
}

export const OBSERVED_MARKERS: ObservedMarker[] = [
  // Behavioural
  { slug: 'chasing-losses', label: 'Chasing losses', category: 'behavioural', weight: 0.75, dataMarker: 'chasing-losses', description: 'Increasing stakes or session length to recover prior losses.' },
  { slug: 'escalating-stakes', label: 'Escalating stakes', category: 'behavioural', weight: 0.6, dataMarker: 'increasing-bets', description: 'Bet sizes trending up beyond established patterns.' },
  { slug: 'erratic-play', label: 'Erratic play patterns', category: 'behavioural', weight: 0.55, dataMarker: 'deposit-volatility', description: 'Sudden change in games, stakes, or frequency.' },
  { slug: 'limit-evasion', label: 'Attempting to evade limits', category: 'behavioural', weight: 0.85, description: 'Multiple accounts, payment methods, or limit-increase requests.' },

  // Financial
  { slug: 'spend-spike', label: 'Sharp spend increase', category: 'financial', weight: 0.7, dataMarker: 'deposit-escalation', description: 'Deposits or net spend rising well above baseline.' },
  { slug: 'failed-deposits', label: 'Repeated failed deposits', category: 'financial', weight: 0.6, description: 'Declined cards or insufficient-funds attempts.' },
  { slug: 'withdrawal-reversal', label: 'Cancels withdrawals to keep playing', category: 'financial', weight: 0.8, dataMarker: 'impulsive-transactions', description: 'Reverses pending withdrawals back into play.' },

  // Time
  { slug: 'session-length', label: 'Extended session length', category: 'time', weight: 0.5, dataMarker: 'longer-sessions', description: 'Sessions markedly longer than usual.' },
  { slug: 'late-night-play', label: 'Late-night / overnight play', category: 'time', weight: 0.45, dataMarker: 'late-night-play', description: 'Concentrated play in early-morning hours.' },
  { slug: 'frequency-spike', label: 'Increased frequency', category: 'time', weight: 0.5, dataMarker: 'play-frequency', description: 'More sessions per day/week than baseline.' },

  // Emotional (data-blind)
  { slug: 'distress', label: 'Signs of distress', category: 'emotional', weight: 0.8, description: 'Frustration, agitation, or upset observed or reported.' },
  { slug: 'self-disclosure', label: 'Self-disclosed concern', category: 'emotional', weight: 1, critical: true, description: 'Patron expressed worry about their own gambling.' },
  { slug: 'irritability', label: 'Irritability when interrupted', category: 'emotional', weight: 0.6, description: 'Reacts negatively to breaks or player-health prompts.' },

  // Social (data-blind)
  { slug: 'third-party-concern', label: 'Third-party concern raised', category: 'social', weight: 0.9, critical: true, description: 'Family member or associate flagged the patron.' },
  { slug: 'isolation', label: 'Social withdrawal', category: 'social', weight: 0.6, description: 'Playing alone, avoiding prior social context.' },
]

export const OBSERVED_MARKER_BY_SLUG = new Map(OBSERVED_MARKERS.map((m) => [m.slug, m]))
export function observedMarker(slug: string): ObservedMarker | undefined {
  return OBSERVED_MARKER_BY_SLUG.get(slug)
}

// ── Interaction shape (kinds + methods staff pick when logging) ──────────────

export const INTERACTION_KINDS = ['observation', 'rg_conversation', 'intervention', 'referral', 'follow_up'] as const
export type InteractionKind = (typeof INTERACTION_KINDS)[number]

export const INTERACTION_KIND_LABELS: Record<InteractionKind, string> = {
  observation: 'Observation',
  rg_conversation: 'Player-health conversation',
  intervention: 'Intervention',
  referral: 'Support referral',
  follow_up: 'Follow-up',
}

/** How much the *kind* of interaction amplifies its markers — a referral means
 *  staff already judged the concern serious; a passing observation less so. */
export const KIND_WEIGHT: Record<InteractionKind, number> = {
  observation: 0.6,
  rg_conversation: 0.8,
  intervention: 1,
  referral: 1,
  follow_up: 0.7,
}

export const INTERACTION_METHODS = ['in_person', 'phone', 'email', 'chat', 'sms', 'other'] as const
export type InteractionMethod = (typeof INTERACTION_METHODS)[number]

export const INTERACTION_METHOD_LABELS: Record<InteractionMethod, string> = {
  in_person: 'In person',
  phone: 'Phone',
  email: 'Email',
  chat: 'Chat',
  sms: 'SMS',
  other: 'Other',
}

/** Outcome recorded on a follow-up — the human close-out that makes the risk
 *  overlay a TWO-WAY ratchet: a resolved / no-concern follow-up clears a
 *  standing disclosure floor and dampens observed corroboration, so staff can
 *  record "we checked in, they're fine" rather than only ever adding risk. */
export const INTERACTION_OUTCOMES = ['ongoing', 'resolved', 'no_concern'] as const
export type InteractionOutcome = (typeof INTERACTION_OUTCOMES)[number]

export const INTERACTION_OUTCOME_LABELS: Record<InteractionOutcome, string> = {
  ongoing: 'Concern ongoing',
  resolved: 'Concern resolved',
  no_concern: 'Checked — no concern',
}

// ── Signal shape produced from a player's interaction log ────────────────────

export interface ObservedContribution {
  slug: string
  label: string
  category: MarkerCategory
  weight: number
  /** Recency factor (0-1) of the strongest interaction carrying this marker. */
  recency: number
  /** Incremental-information factor (0-1): 1 when data-blind or the data disagrees,
   *  →0 when the data already scores this high. */
  info: number
  contribution: number
}

export interface ObservedSignal {
  /** 0-100 observed-risk load derived from the interaction log. */
  score: number
  /** Bounded additive points applied to the data-derived score (corroboration). */
  uplift: number
  /** Minimum combined score enforced by an OPEN critical disclosure (0 = none). */
  floor: number
  /** Number of interactions inside the window. */
  count: number
  /** ISO timestamp of the most recent interaction. */
  lastAt: string | null
  /** Strongest marker contributions, for display. */
  top: ObservedContribution[]
  byCategory: Record<MarkerCategory, number>
  /** A critical disclosure is present. */
  hasCritical: boolean
  /** Standing-concern state: none, open (floor active), or resolved (closed by a follow-up). */
  concern: 'none' | 'open' | 'resolved'
  /** The most recent interaction was a "no concern" follow-up — corroboration is dampened. */
  reassured: boolean
}
