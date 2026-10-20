// One-line plain-language definitions for the 13 behavioural markers, surfaced
// in click-to-open popovers. The quantitative side (weight, evidence source,
// univariate AUC) comes from MODEL_CARD.markers; this is the "what does it mean"
// layer for operators.

export const MARKER_INFO: Record<string, string> = {
  'chasing-losses': 'Increasing stakes or deposits straight after a loss, trying to win it back.',
  'increasing-bets': 'Average and peak stake sizes drifting upward over the window.',
  'deposit-volatility': 'Erratic, spiky deposit amounts rather than a steady, budgeted pattern.',
  'loss-of-winnings': 'Giving winnings straight back into play instead of banking them.',
  'payment-switching': 'Cycling through multiple payment methods, often to keep funding play.',
  'impulsive-transactions': 'Cancelled withdrawals and rapid re-deposits — money pulled back into play.',
  'longer-sessions': 'Session durations getting longer as the window progresses.',
  'play-frequency': 'More active days and longer streaks of consecutive-day play.',
  'late-night-play': 'A rising share of play happening in the small hours.',
  'faster-games': 'Shifting toward faster, higher-intensity game types.',
  'tolerance-for-loss': 'Sustaining larger net losses without slowing down.',
  'inability-to-stop': 'Continuing to play through sustained losses.',
  'deposit-escalation': 'Deposit frequency ramping up week over week.',
}
