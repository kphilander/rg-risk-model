import { create } from 'zustand'
import type {
  Interaction,
  InterventionAction,
  InterventionLevel,
  PlayerProfile,
  RiskAssessment,
} from '../types'
import type {
  InteractionKind,
  InteractionMethod,
  InteractionOutcome,
} from '../core/observedMarkers'
import {
  INTERACTION_KIND_LABELS,
  INTERACTION_OUTCOME_LABELS,
  observedMarker,
} from '../core/observedMarkers'
import type { PortfolioStats } from '../engine/scoring'
import { platform } from '../core/runtime'
import { foldObservedAll } from '../engine/observed'
import { seedInteractions } from '../data/interactions'
import {
  appendEntry,
  buildChain,
  verifyChain,
  type AuditEntry,
  type NewAuditEntry,
} from '../core/auditChain'
import { useCaseStore } from './useCaseStore'
import type { RiskModel } from '../core/riskModel'
import { BRAND } from '../brand'

const THEME_KEY = `${BRAND.slug}.theme.v1`
const HELP_KEY = `${BRAND.slug}.help.v1`
const INTERACTIONS_KEY = `${BRAND.slug}.interactions-log.v1`
const AUDIT_KEY = `${BRAND.slug}.audit-chain.v1`
// The signed-in player-protection agent (would come from SSO/RBAC in prod).
const OPERATOR = 'a.nielsen@operator.example'

function loadTheme(): 'light' | 'dark' {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    if (raw === 'light' || raw === 'dark') return raw
  } catch {
    /* ignore */
  }
  return 'light'
}

function loadHelp(): boolean {
  try {
    return localStorage.getItem(HELP_KEY) === '1'
  } catch {
    return false
  }
}

function loadInteractions(): Interaction[] | null {
  try {
    const raw = localStorage.getItem(INTERACTIONS_KEY)
    return raw ? (JSON.parse(raw) as Interaction[]) : null
  } catch {
    return null
  }
}
function saveInteractions(list: Interaction[]) {
  try {
    localStorage.setItem(INTERACTIONS_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}
function loadAudit(): AuditEntry[] | null {
  try {
    const raw = localStorage.getItem(AUDIT_KEY)
    return raw ? (JSON.parse(raw) as AuditEntry[]) : null
  } catch {
    return null
  }
}
function saveAudit(list: AuditEntry[]) {
  try {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

/** Turn a staff interaction into an audit-chain entry. */
function interactionAudit(it: Interaction, handle: string | null): NewAuditEntry {
  const markers = it.markers.map((s) => observedMarker(s)?.label ?? s).join(', ')
  const outcome = it.outcome ? ` · ${INTERACTION_OUTCOME_LABELS[it.outcome]}` : ''
  return {
    timestamp: it.timestamp,
    actor: it.operator,
    playerId: it.playerId,
    playerHandle: handle,
    kind: 'interaction',
    action: `${INTERACTION_KIND_LABELS[it.kind]}${markers ? ` — ${markers}` : ''}${outcome}`,
    meta: it,
  }
}

const MODEL_KEY = `${BRAND.slug}.model.v1`
function loadModel(): RiskModel | null {
  try {
    const raw = localStorage.getItem(MODEL_KEY)
    if (!raw) return null
    const m = JSON.parse(raw) as RiskModel
    // A persisted copy of an older reference default is superseded by the
    // shipped default; operator-fit and manually tuned models are preserved.
    return m.provenance === 'reference-fit' ? null : m
  } catch {
    return null
  }
}
function saveModel(m: RiskModel) {
  try {
    localStorage.setItem(MODEL_KEY, JSON.stringify(m))
  } catch {
    /* ignore */
  }
}
/** A config with a given model's weights + calibration swapped in — an
 *  operator-adopted model changes what the engine scores with. */
function configFor(model: RiskModel) {
  return { ...platform.config, markerWeights: model.markerWeights, model }
}

// Bootstrap the portfolio through the platform's selected data source + engine.
const loaded = platform.dataSource.load(platform.tenant)
const bootPlayers: PlayerProfile[] = Array.isArray(loaded) ? loaded : []
// Active risk model (operator-adopted or the default reference fit), data-derived
// base, then the staff interaction log folded in (engine/observed.ts). The base
// is kept so any new interaction re-folds from clean data.
const bootModel = loadModel() ?? platform.config.model
const bootBase = platform.engine.assessAll(bootPlayers, configFor(bootModel))
const bootInteractions = loadInteractions() ?? seedInteractions(bootPlayers, bootBase)
const bootAssessments = foldObservedAll(bootPlayers, bootBase, bootInteractions, platform.config)
const bootStats = platform.engine.summarize(bootPlayers, bootAssessments)
const initialLog = platform.audit.load(platform.tenant)
const bootAudit = loadAudit()
const handleOf = (id: string): string | null => bootPlayers.find((p) => p.id === id)?.handle ?? null

export interface Filters {
  search: string
  bands: string[]
  jurisdiction: string
  sort: 'score' | 'delta' | 'lastActive' | 'handle'
  sortDir: 'asc' | 'desc'
}

interface StoreState {
  players: PlayerProfile[]
  assessments: Map<string, RiskAssessment>
  /** Data-derived assessments before the interaction-log overlay (for re-folding). */
  baseAssessments: Map<string, RiskAssessment>
  stats: PortfolioStats
  interventions: InterventionAction[]
  interactions: Interaction[]
  /** Tamper-evident hash-chained audit of every score-affecting action. */
  audit: AuditEntry[]
  /** Show the combined (data + observations) score, or the validated data-only score. */
  scoreBasis: 'combined' | 'data'
  /** Active risk model — the default reference fit, or an operator-adopted re-fit. */
  riskModel: RiskModel
  /** Outcome labels from an imported dataset (calibrate on your own data), if any. */
  importedLabels: Map<string, number> | null
  filters: Filters
  theme: 'light' | 'dark'
  /** Global "explain this page" help mode. */
  helpOpen: boolean
  /** Mobile navigation drawer (below the lg breakpoint). Not persisted. */
  navOpen: boolean
  // actions
  toggleHelp: () => void
  setNavOpen: (open: boolean) => void
  setScoreBasis: (basis: 'combined' | 'data') => void
  /** Adopt a (re-fit) risk model → re-score the whole portfolio. */
  setRiskModel: (model: RiskModel) => void
  verifyAudit: () => Promise<{ ok: boolean; brokenAt: number | null }>
  logIntervention: (
    playerId: string,
    level: InterventionLevel,
    action: string,
    note: string,
  ) => void
  resolveIntervention: (id: string) => void
  /** Log a staff interaction; re-folds the player's score with the new observation. */
  logInteraction: (
    playerId: string,
    input: {
      kind: InteractionKind
      method: InteractionMethod
      markers: string[]
      note: string
      outcome?: InteractionOutcome
    },
  ) => void
  /** Replace the live portfolio with an imported/scored dataset. */
  loadDataset: (
    players: PlayerProfile[],
    assessments: Map<string, RiskAssessment>,
    stats: PortfolioStats,
    labels?: Map<string, number>,
  ) => void
  setFilters: (patch: Partial<Filters>) => void
  resetFilters: () => void
  toggleTheme: () => void
  getPlayer: (id: string) => PlayerProfile | undefined
  getAssessment: (id: string) => RiskAssessment | undefined
}

const DEFAULT_FILTERS: Filters = {
  search: '',
  bands: [],
  jurisdiction: 'all',
  sort: 'score',
  sortDir: 'desc',
}

export const useStore = create<StoreState>((set, get) => ({
  players: bootPlayers,
  assessments: bootAssessments,
  baseAssessments: bootBase,
  stats: bootStats,
  interventions: Array.isArray(initialLog) ? initialLog : [],
  interactions: bootInteractions,
  audit: bootAudit ?? [],
  scoreBasis: 'combined',
  riskModel: bootModel,
  importedLabels: null,
  filters: DEFAULT_FILTERS,
  theme: loadTheme(),
  helpOpen: loadHelp(),
  navOpen: false,
  setNavOpen: (open) => set({ navOpen: open }),

  toggleHelp: () => {
    const helpOpen = !get().helpOpen
    try {
      localStorage.setItem(HELP_KEY, helpOpen ? '1' : '0')
    } catch {
      /* ignore */
    }
    set({ helpOpen })
  },

  setScoreBasis: (basis) => {
    const { players, baseAssessments, interactions } = get()
    const assessments =
      basis === 'data'
        ? baseAssessments
        : foldObservedAll(players, baseAssessments, interactions, platform.config)
    const stats = platform.engine.summarize(players, assessments)
    set({ scoreBasis: basis, assessments, stats })
  },

  setRiskModel: (model) => {
    saveModel(model)
    const { players, interactions, scoreBasis } = get()
    const baseAssessments = platform.engine.assessAll(players, configFor(model))
    const combined = foldObservedAll(players, baseAssessments, interactions, platform.config)
    const assessments = scoreBasis === 'data' ? baseAssessments : combined
    const stats = platform.engine.summarize(players, assessments)
    set({ riskModel: model, baseAssessments, assessments, stats })
  },

  verifyAudit: () => verifyChain(get().audit),

  logIntervention: (playerId, level, action, note) => {
    const player = get().getPlayer(playerId)
    const assessment = get().getAssessment(playerId)
    if (!player) return
    const entry: InterventionAction = {
      id: `INT-${Date.now().toString(36)}-${Math.floor(performance.now()).toString(36)}`,
      playerId,
      playerHandle: player.handle,
      level,
      action,
      note,
      riskAtTime: assessment?.score ?? 0,
      operator: OPERATOR,
      timestamp: new Date().toISOString(),
      status: 'logged',
    }
    // Persist to the audit sink, chain into the tamper-evident audit, and write
    // the action back to the operator.
    platform.audit.append(entry)
    void platform.actions.dispatch(entry, platform.tenant)
    set({ interventions: [entry, ...get().interventions] })
    appendAudit({
      timestamp: entry.timestamp,
      actor: entry.operator,
      playerId: entry.playerId,
      playerHandle: entry.playerHandle,
      kind: 'intervention',
      action: `Level ${entry.level} — ${entry.action}`,
      meta: entry,
    })
  },

  resolveIntervention: (id) => {
    platform.audit.update(id, { status: 'resolved' })
    const target = get().interventions.find((i) => i.id === id)
    set({
      interventions: get().interventions.map((i) =>
        i.id === id ? { ...i, status: 'resolved' as const } : i,
      ),
    })
    if (target) {
      appendAudit({
        timestamp: new Date().toISOString(),
        actor: OPERATOR,
        playerId: target.playerId,
        playerHandle: target.playerHandle,
        kind: 'intervention_resolved',
        action: `Resolved: Level ${target.level} — ${target.action}`,
        meta: { interventionId: id },
      })
    }
  },

  logInteraction: (playerId, input) => {
    const player = get().getPlayer(playerId)
    const entry: Interaction = {
      id: `IX-${Date.now().toString(36)}-${Math.floor(performance.now()).toString(36)}`,
      playerId,
      timestamp: new Date().toISOString(),
      kind: input.kind,
      method: input.method,
      markers: input.markers,
      outcome: input.outcome,
      note: input.note,
      operator: OPERATOR,
    }
    const interactions = [entry, ...get().interactions]
    saveInteractions(interactions)
    const { players, baseAssessments, scoreBasis } = get()
    // Always recompute the combined map (cases + audit reflect true risk); the
    // active view honours the current basis.
    const combined = foldObservedAll(players, baseAssessments, interactions, platform.config)
    const assessments = scoreBasis === 'data' ? baseAssessments : combined
    const stats = platform.engine.summarize(players, assessments)
    set({ interactions, assessments, stats })
    // A new observation can raise recommendedLevel → open a case if warranted.
    useCaseStore.getState().syncFromAssessments(players, combined)
    appendAudit(interactionAudit(entry, player?.handle ?? null))
  },

  loadDataset: (players, assessments, stats, labels) => {
    saveInteractions([])
    saveAudit([])
    set({
      players,
      assessments,
      baseAssessments: assessments,
      stats,
      interactions: [],
      audit: [],
      scoreBasis: 'combined',
      importedLabels: labels ?? null,
      filters: DEFAULT_FILTERS,
    })
  },

  setFilters: (patch) => set({ filters: { ...get().filters, ...patch } }),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  toggleTheme: () => {
    const theme = get().theme === 'light' ? 'dark' : 'light'
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* ignore */
    }
    set({ theme })
  },

  getPlayer: (id) => get().players.find((p) => p.id === id),
  getAssessment: (id) => get().assessments.get(id),
}))

// ── Tamper-evident audit chain: serialized async append + one-time seed ──────
let auditQueue: Promise<void> = Promise.resolve()
function appendAudit(n: NewAuditEntry) {
  auditQueue = auditQueue.then(async () => {
    const chain = useStore.getState().audit
    const entry = await appendEntry(chain, n)
    const next = [...chain, entry]
    saveAudit(next)
    useStore.setState({ audit: next })
  })
}

// Seed the audit with the synthetic interaction history so the compliance trail
// is populated + verifiable out of the box (only if nothing is persisted yet).
if (!bootAudit && bootInteractions.length) {
  const seedEntries = [...bootInteractions]
    .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1))
    .map((it) => interactionAudit(it, handleOf(it.playerId)))
  auditQueue = auditQueue.then(async () => {
    if (useStore.getState().audit.length > 0) return // a live action beat the seed
    const chain = await buildChain(seedEntries)
    useStore.setState({ audit: chain })
  })
}

// Async data sources (REST / streaming) hydrate once their promise settles.
if (!Array.isArray(loaded)) {
  Promise.resolve(loaded).then((players) => {
    const base = platform.engine.assessAll(players, configFor(useStore.getState().riskModel))
    const interactions = useStore.getState().interactions
    const assessments = foldObservedAll(players, base, interactions, platform.config)
    const stats = platform.engine.summarize(players, assessments)
    useStore.setState({ players, assessments, baseAssessments: base, stats })
  })
}

/** The latest activity date in the loaded portfolio — the "as of" date of the
 *  data. Data timestamps (last active, seeded observations) are shown relative
 *  to this date, not to the wall clock, so a historical or synthetic dataset
 *  does not read as stale. */
export function useDataAsOf(): string | null {
  return useStore((s) => {
    let max: string | null = null
    for (const p of s.players) if (p.lastActive && (max === null || p.lastActive > max)) max = p.lastActive
    return max
  })
}
