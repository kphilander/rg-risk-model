import type { RiskBand, RiskBandId } from '../types'

// Single source of truth for the 5 escalating risk bands.
// Mirrors the `risk.*` colors in tailwind.config.js.
export const RISK_BANDS: RiskBand[] = [
  {
    id: 'low',
    label: 'Low',
    min: 0,
    max: 19,
    color: '#4f8a5f',
    tint: 'rgba(79, 138, 95, 0.13)',
    description: 'Recreational play. Automated monitoring only.',
  },
  {
    id: 'moderate',
    label: 'Moderate',
    min: 20,
    max: 37,
    color: '#a3841a',
    tint: 'rgba(163, 132, 26, 0.14)',
    description: 'Rising indicators. Automated nudges and self-help prompts.',
  },
  {
    id: 'elevated',
    label: 'Elevated',
    min: 38,
    max: 51,
    color: '#c46a1c',
    tint: 'rgba(196, 106, 28, 0.13)',
    description: 'Sustained risk markers. Direct operator outreach advised.',
  },
  {
    id: 'high',
    label: 'High',
    min: 52,
    max: 65,
    color: '#d1432b',
    tint: 'rgba(209, 67, 43, 0.12)',
    description: 'Clear harm indicators. Apply deposit limits and controls.',
  },
  {
    id: 'critical',
    label: 'Critical',
    min: 66,
    max: 100,
    color: '#b81d45',
    tint: 'rgba(184, 29, 69, 0.12)',
    description: 'Severe risk. Intensive support and referral required.',
  },
]

export function bandForScore(score: number, bands: RiskBand[] = RISK_BANDS): RiskBand {
  const clamped = Math.max(0, Math.min(100, score))
  return bands.find((b) => clamped >= b.min && clamped <= b.max) ?? bands[bands.length - 1]
}

export function bandById(id: RiskBandId): RiskBand {
  return RISK_BANDS.find((b) => b.id === id) ?? RISK_BANDS[0]
}

// Each band maps to a recommended intervention escalation level (1-5).
export const ESCALATION: Record<
  RiskBandId,
  { level: number; action: string; detail: string }
> = {
  low: {
    level: 1,
    action: 'Automated monitoring',
    detail: 'Continue passive monitoring. No contact required.',
  },
  moderate: {
    level: 2,
    action: 'Self-help nudge',
    detail: 'Surface responsible-gambling tools and reality-check pop-ups.',
  },
  elevated: {
    level: 3,
    action: 'Operator outreach',
    detail: 'Personalised safer-gambling message from the player-protection team.',
  },
  high: {
    level: 4,
    action: 'Apply controls',
    detail: 'Recommend deposit limits, cool-off, or play restrictions.',
  },
  critical: {
    level: 5,
    action: 'Support referral',
    detail: 'Escalate to specialist support and consider account suspension.',
  },
}
