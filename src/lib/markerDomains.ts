// Behavioral-marker "domains" (categories). Each marker belongs to one domain,
// shown in the UI as a small categorical dot. The dot answers "which domain" —
// so these are one slate scale, kept clear of the warm risk ramp
// (sage / ochre / rust / brick / crimson), which signals "how severe".

export interface Domain {
  id: string
  label: string
  color: string
}

export const DOMAINS: Record<string, Domain> = {
  financial: { id: 'financial', label: 'Financial', color: '#3e6488' }, // slate (dark)
  temporal: { id: 'temporal', label: 'Time & frequency', color: '#7a8fa6' }, // slate (mid)
  control: { id: 'control', label: 'Control & product', color: '#a9b6c3' }, // slate (light)
}

// Marker id → domain id.
const MARKER_DOMAIN: Record<string, string> = {
  'chasing-losses': 'financial',
  'increasing-bets': 'financial',
  'deposit-volatility': 'financial',
  'loss-of-winnings': 'financial',
  'payment-switching': 'financial',
  'impulsive-transactions': 'financial',
  'deposit-escalation': 'financial',
  'tolerance-for-loss': 'financial',
  'longer-sessions': 'temporal',
  'play-frequency': 'temporal',
  'late-night-play': 'temporal',
  'faster-games': 'control',
  'inability-to-stop': 'control',
}

export function domainForMarker(markerId: string): Domain {
  return DOMAINS[MARKER_DOMAIN[markerId] ?? 'control']
}
