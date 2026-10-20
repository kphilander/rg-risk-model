import { create } from 'zustand'
import type { PlayerProfile, RiskAssessment } from '../types'
import { bandForScore } from '../lib/riskBands'
import { BRAND } from '../brand'

// Case-management store for the triage/casework surface. Kept separate from the
// primary portfolio store (useStore) and persisted independently to
// localStorage, mirroring the app's own manual-persistence pattern.

const CASES_KEY = `${BRAND.slug}.cases.v1`

export type CasePriority = 'low' | 'medium' | 'high' | 'urgent'
export type CaseStatus = 'open' | 'in_progress' | 'awaiting' | 'resolved'

export interface CaseNote {
  id: string
  author: string
  ts: string
  text: string
}

export interface Case {
  id: string
  playerId: string
  playerHandle: string
  country: string
  assignee: string
  priority: CasePriority
  status: CaseStatus
  /** ISO datetime the SLA response is due. */
  slaDueAt: string
  createdAt: string
  updatedAt: string
  notes: CaseNote[]
}

// Small synthetic analyst pool. "unassigned" is a sentinel, not a person.
export const ANALYSTS = ['A. Nielsen', 'M. Okafor', 'L. Berg'] as const
export const UNASSIGNED = 'unassigned'
// The signed-in analyst — author for notes added in-session.
export const CURRENT_ANALYST = 'A. Nielsen'

export const PRIORITY_ORDER: Record<CasePriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export const STATUS_LABEL: Record<CaseStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  awaiting: 'Awaiting player',
  resolved: 'Resolved',
}

export const PRIORITY_LABEL: Record<CasePriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

// SLA target (hours) by priority — used to stagger due dates on seed.
const SLA_HOURS: Record<CasePriority, number> = {
  urgent: 4,
  high: 24,
  medium: 72,
  low: 168,
}

interface CaseStoreState {
  cases: Case[]
  seeded: boolean
  ensureSeeded: (
    players: PlayerProfile[],
    assessments: Map<string, RiskAssessment>,
  ) => void
  /** Open cases for any player who has newly reached recommendedLevel >= 4
   *  (e.g. a staff observation raised their band) and doesn't already have one. */
  syncFromAssessments: (
    players: PlayerProfile[],
    assessments: Map<string, RiskAssessment>,
  ) => void
  assign: (caseId: string, assignee: string) => void
  setStatus: (caseId: string, status: CaseStatus) => void
  setPriority: (caseId: string, priority: CasePriority) => void
  addNote: (caseId: string, text: string, author?: string) => void
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`
}

function loadCases(): Case[] | null {
  try {
    const raw = localStorage.getItem(CASES_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as Case[]
  } catch {
    /* corrupt or unavailable storage — treat as empty */
  }
  return null
}

function persist(cases: Case[]): void {
  try {
    localStorage.setItem(CASES_KEY, JSON.stringify(cases))
  } catch {
    /* ignore quota / private-mode errors */
  }
}

// Priority is driven by the risk band: Critical → urgent, High → high, and
// everything below (only reached via the fallback path) → medium.
function priorityForScore(score: number): CasePriority {
  const band = bandForScore(score)
  if (band.id === 'critical') return 'urgent'
  if (band.id === 'high') return 'high'
  if (band.id === 'elevated') return 'medium'
  return 'low'
}

// Build the initial case book from the current portfolio. Opens a case per
// player whose recommended escalation is >= 4; if the synthetic portfolio is
// calmer than that, fall back to the ~18 highest-scoring players so the queue
// is never empty on first load.
function seedCases(
  players: PlayerProfile[],
  assessments: Map<string, RiskAssessment>,
): Case[] {
  const scored = players
    .map((p) => ({ p, a: assessments.get(p.id) }))
    .filter((x): x is { p: PlayerProfile; a: RiskAssessment } => Boolean(x.a))

  let targets = scored.filter((x) => x.a.recommendedLevel >= 4)
  if (targets.length === 0) {
    targets = [...scored].sort((x, y) => y.a.score - x.a.score).slice(0, 18)
  }
  // Highest-risk first so the freshest, most severe cases sit at the top.
  targets.sort((x, y) => y.a.score - x.a.score)

  const now = Date.now()
  const HOUR = 3_600_000

  return targets.map(({ p, a }, i) => {
    const priority = priorityForScore(a.score)
    // Stagger creation across the past few days; higher-risk cases are older
    // in the queue so a chunk of them breach SLA — realistic triage pressure.
    const ageHours = 2 + i * 7
    const createdAt = new Date(now - ageHours * HOUR).toISOString()
    const slaDueAt = new Date(
      now - ageHours * HOUR + SLA_HOURS[priority] * HOUR,
    ).toISOString()

    // Round-robin the analyst pool but leave roughly every fourth case
    // unassigned so the "unassigned" KPI has something to show.
    const assignee = i % 4 === 3 ? UNASSIGNED : ANALYSTS[i % ANALYSTS.length]

    // Seed a couple of cases as already in-flight for a lived-in feel.
    let status: CaseStatus = 'open'
    if (assignee !== UNASSIGNED) {
      if (i % 5 === 1) status = 'in_progress'
      else if (i % 5 === 2) status = 'awaiting'
    }

    const notes: CaseNote[] = [
      {
        id: uid('N'),
        author: 'system',
        ts: createdAt,
        text: `Case opened automatically — risk ${a.score}/100 (${a.band.label}), recommended escalation level ${a.recommendedLevel}.`,
      },
    ]
    if (status === 'in_progress' || status === 'awaiting') {
      notes.push({
        id: uid('N'),
        author: assignee,
        ts: new Date(now - (ageHours - 1) * HOUR).toISOString(),
        text:
          status === 'awaiting'
            ? 'Reached out with a safer-gambling check-in. Awaiting player response.'
            : 'Reviewing recent deposit and session pattern before outreach.',
      })
    }

    return {
      id: `CASE-${(1001 + i).toString()}`,
      playerId: p.id,
      playerHandle: p.handle,
      country: p.country,
      assignee,
      priority,
      status,
      slaDueAt,
      createdAt,
      updatedAt: notes[notes.length - 1].ts,
      notes,
    }
  })
}

export const useCaseStore = create<CaseStoreState>((set, get) => ({
  cases: loadCases() ?? [],
  seeded: loadCases() !== null,

  ensureSeeded: (players, assessments) => {
    if (get().seeded || get().cases.length > 0) {
      if (!get().seeded) set({ seeded: true })
      return
    }
    if (players.length === 0) return // portfolio not hydrated yet — try again later
    const cases = seedCases(players, assessments)
    persist(cases)
    set({ cases, seeded: true })
  },

  syncFromAssessments: (players, assessments) => {
    const existing = new Set(get().cases.map((c) => c.playerId))
    const toOpen = players
      .map((p) => ({ p, a: assessments.get(p.id) }))
      .filter(
        (x): x is { p: PlayerProfile; a: RiskAssessment } =>
          Boolean(x.a) && x.a!.recommendedLevel >= 4 && !existing.has(x.p.id),
      )
    if (toOpen.length === 0) return
    const now = Date.now()
    const HOUR = 3_600_000
    const opened: Case[] = toOpen.map(({ p, a }) => {
      const priority = priorityForScore(a.score)
      const createdAt = new Date(now).toISOString()
      return {
        id: uid('CASE'),
        playerId: p.id,
        playerHandle: p.handle,
        country: p.country,
        assignee: UNASSIGNED,
        priority,
        status: 'open' as const,
        slaDueAt: new Date(now + SLA_HOURS[priority] * HOUR).toISOString(),
        createdAt,
        updatedAt: createdAt,
        notes: [
          {
            id: uid('N'),
            author: 'system',
            ts: createdAt,
            text: `Case opened — risk ${a.score}/100 (${a.band.label}); a staff observation raised recommended escalation to level ${a.recommendedLevel}.`,
          },
        ],
      }
    })
    const next = [...opened, ...get().cases]
    persist(next)
    set({ cases: next })
  },

  assign: (caseId, assignee) => {
    const next = get().cases.map((c) =>
      c.id === caseId
        ? { ...c, assignee, updatedAt: new Date().toISOString() }
        : c,
    )
    persist(next)
    set({ cases: next })
  },

  setStatus: (caseId, status) => {
    const next = get().cases.map((c) =>
      c.id === caseId ? { ...c, status, updatedAt: new Date().toISOString() } : c,
    )
    persist(next)
    set({ cases: next })
  },

  setPriority: (caseId, priority) => {
    const next = get().cases.map((c) =>
      c.id === caseId
        ? { ...c, priority, updatedAt: new Date().toISOString() }
        : c,
    )
    persist(next)
    set({ cases: next })
  },

  addNote: (caseId, text, author = CURRENT_ANALYST) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const ts = new Date().toISOString()
    const note: CaseNote = { id: uid('N'), author, ts, text: trimmed }
    const next = get().cases.map((c) =>
      c.id === caseId
        ? { ...c, notes: [...c.notes, note], updatedAt: ts }
        : c,
    )
    persist(next)
    set({ cases: next })
  },
}))
