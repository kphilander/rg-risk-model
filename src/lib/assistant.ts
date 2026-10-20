import type { PlayerProfile, RiskAssessment } from '../types'
import type { PortfolioStats } from '../engine/scoring'
import { ESCALATION, RISK_BANDS } from './riskBands'
import { domainForMarker } from './markerDomains'

/** Recommended escalation action for a 1-5 level. */
function actionForLevel(level: number): string {
  const band = RISK_BANDS[Math.max(0, Math.min(4, level - 1))]
  return ESCALATION[band.id].action
}

export interface AnswerItem {
  primary: string
  secondary?: string
  to?: string
  score?: number
  bandColor?: string
  bandLabel?: string
  accent?: string
}

export interface AssistantAnswer {
  title: string
  summary: string
  items?: AnswerItem[]
  bullets?: { text: string; color?: string }[]
}

export interface StarterPrompt {
  id: string
  label: string
  hint: string
}

export const STARTERS: StarterPrompt[] = [
  { id: 'intervene', label: 'Who needs intervention right now?', hint: 'Players at the highest escalation levels' },
  { id: 'drivers', label: "What's driving portfolio risk?", hint: 'The markers moving scores most' },
  { id: 'rising', label: 'Where is risk rising fastest?', hint: 'Sharpest 7-day increases' },
  { id: 'summary', label: 'Summarize the portfolio', hint: 'A quick read on overall health' },
]

interface Ctx {
  players: PlayerProfile[]
  assessments: Map<string, RiskAssessment>
  stats: PortfolioStats
}

function ranked(ctx: Ctx) {
  return ctx.players
    .map((p) => ({ p, a: ctx.assessments.get(p.id)! }))
    .filter((x) => x.a)
    .sort((x, y) => y.a.score - x.a.score)
}

export function answerFor(id: string, ctx: Ctx): AssistantAnswer {
  switch (id) {
    case 'intervene': {
      const urgent = ranked(ctx).filter(({ a }) => a.recommendedLevel >= 4).slice(0, 6)
      return {
        title: 'Players needing intervention',
        summary:
          urgent.length === 0
            ? 'No players are currently at the highest escalation levels (4–5).'
            : `${urgent.length} player${urgent.length === 1 ? '' : 's'} are at escalation level 4 or 5 and warrant direct contact or limits. The most urgent are listed below, each with the marker driving the recommendation.`,
        items: urgent.map(({ p, a }) => ({
          primary: p.handle,
          secondary: `${p.country} · ${a.topMarkers[0].label} · L${a.recommendedLevel} ${actionForLevel(a.recommendedLevel)}`,
          to: `/players/${p.id}`,
          score: a.score,
          bandColor: a.band.color,
          bandLabel: a.band.label,
        })),
      }
    }
    case 'drivers': {
      const top = ctx.stats.topMarkers.slice(0, 5)
      return {
        title: 'What is driving portfolio risk',
        summary: `Across all ${ctx.stats.totalPlayers.toLocaleString()} players, these markers contribute the most to risk scores on average. Colour indicates the behavioral domain.`,
        bullets: top.map((m) => {
          const d = domainForMarker(m.id)
          return { text: `${m.label} — avg contribution ${Math.round(m.avg)} (${d.label})`, color: d.color }
        }),
      }
    }
    case 'rising': {
      const climbing = ranked(ctx)
        .filter(({ a }) => (a.delta7d ?? 0) > 0)
        .sort((x, y) => (y.a.delta7d ?? 0) - (x.a.delta7d ?? 0))
        .slice(0, 6)
      return {
        title: 'Risk rising fastest',
        summary:
          climbing.length === 0
            ? 'No players show a meaningful 7-day increase right now.'
            : `${climbing.length} players show the sharpest 7-day increases in risk score. Rising trajectories often precede escalation — worth a closer look before they cross a band.`,
        items: climbing.map(({ p, a }) => ({
          primary: p.handle,
          secondary: `${p.country} · ${a.topMarkers[0].label}`,
          to: `/players/${p.id}`,
          score: a.score,
          bandColor: a.band.color,
          bandLabel: a.band.label,
          accent: `+${a.delta7d} pts / 7d`,
        })),
      }
    }
    case 'summary':
    default: {
      const s = ctx.stats
      const high = s.bandCounts.high + s.bandCounts.critical
      const pct = ((high / s.totalPlayers) * 100).toFixed(1)
      return {
        title: 'Portfolio summary',
        summary: `Mean risk index is ${s.averageScore}/100. Of ${s.totalPlayers.toLocaleString()} monitored players, ${high} (${pct}%) sit in the High or Critical bands and should be prioritised.`,
        bullets: [
          { text: `${s.bandCounts.low} Low · ${s.bandCounts.moderate} Moderate · ${s.bandCounts.elevated} Elevated`, color: '#86868b' },
          { text: `${s.bandCounts.high} High-risk players — recommend direct outreach and deposit controls`, color: '#d1432b' },
          { text: `${s.bandCounts.critical} Critical players — recommend specialist support referral`, color: '#b81d45' },
        ],
      }
    }
  }
}

/** Map free text to the closest starter, defaulting to a portfolio summary. */
export function matchPrompt(text: string): string {
  const t = text.toLowerCase()
  if (/interven|contact|urgent|action|escalat|limit/.test(t)) return 'intervene'
  if (/driv|marker|cause|why|factor|reason/.test(t)) return 'drivers'
  if (/rising|increas|trend|fast|climb|worse|growing/.test(t)) return 'rising'
  return 'summary'
}
