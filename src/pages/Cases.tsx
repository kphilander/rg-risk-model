import { useEffect, useMemo, useState } from 'react'
import { ArrowUpDown, Inbox, SlidersHorizontal } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { KpiCard } from '../components/KpiCard'
import { CaseRow } from '../components/cases/CaseRow'
import { CaseDetail } from '../components/cases/CaseDetail'
import { useStore } from '../store/useStore'
import type { Case, CasePriority, CaseStatus } from '../store/useCaseStore'
import {
  ANALYSTS,
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  STATUS_LABEL,
  UNASSIGNED,
  useCaseStore,
} from '../store/useCaseStore'

type StatusFilter = 'all' | CaseStatus
type PriorityFilter = 'all' | CasePriority
type SortKey = 'priority' | 'sla' | 'age'

const STATUS_FILTERS: StatusFilter[] = [
  'all',
  'open',
  'in_progress',
  'awaiting',
  'resolved',
]

// Milliseconds since Unix epoch a week ago — for the "resolved this week" KPI.
function startOfWeekMs(): number {
  return Date.now() - 7 * 24 * 3_600_000
}

export function Cases() {
  const players = useStore((s) => s.players)
  const assessments = useStore((s) => s.assessments)
  const cases = useCaseStore((s) => s.cases)
  const ensureSeeded = useCaseStore((s) => s.ensureSeeded)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')
  const [sort, setSort] = useState<SortKey>('priority')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Seed the case book from the live portfolio on mount (and once players
  // hydrate, if an async data source populated them after first paint).
  useEffect(() => {
    ensureSeeded(players, assessments)
  }, [ensureSeeded, players, assessments])

  const kpis = useMemo(() => {
    const weekStart = startOfWeekMs()
    let open = 0
    let overdue = 0
    let unassigned = 0
    let resolvedThisWeek = 0
    for (const c of cases) {
      if (c.status !== 'resolved') {
        open += 1
        if (new Date(c.slaDueAt).getTime() < Date.now()) overdue += 1
        if (c.assignee === UNASSIGNED) unassigned += 1
      } else if (new Date(c.updatedAt).getTime() >= weekStart) {
        resolvedThisWeek += 1
      }
    }
    return { open, overdue, unassigned, resolvedThisWeek }
  }, [cases])

  const rows = useMemo(() => {
    let list = cases.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (priorityFilter !== 'all' && c.priority !== priorityFilter) return false
      if (assigneeFilter !== 'all' && c.assignee !== assigneeFilter) return false
      return true
    })

    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'sla':
          return new Date(a.slaDueAt).getTime() - new Date(b.slaDueAt).getTime()
        case 'age':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        default:
          // priority first, then soonest SLA within a priority tier
          return (
            PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
            new Date(a.slaDueAt).getTime() - new Date(b.slaDueAt).getTime()
          )
      }
    })
    return list
  }, [cases, statusFilter, priorityFilter, assigneeFilter, sort])

  const selected: Case | undefined = useMemo(
    () => cases.find((c) => c.id === selectedId),
    [cases, selectedId],
  )

  const selectedPlayer = selected
    ? players.find((p) => p.id === selected.playerId)
    : undefined
  const selectedAssessment = selected ? assessments.get(selected.playerId) : undefined

  const hasFilters =
    statusFilter !== 'all' || priorityFilter !== 'all' || assigneeFilter !== 'all'

  return (
    <div>
      <PageHeader
        title="Case management"
        subtitle="Assign flagged players, set priorities, track SLAs, and log interventions."
      />

      {/* KPIs */}
      <div className="kpi-strip mb-5">
        <KpiCard label="Open cases" value={kpis.open} sub="Not yet resolved" />
        <KpiCard
          label="Overdue SLA"
          value={kpis.overdue}
          sub="Past response deadline"
          valueColor={kpis.overdue > 0 ? '#d1432b' : undefined}
        />
        <KpiCard
          label="Unassigned"
          value={kpis.unassigned}
          sub="Awaiting an analyst"
          valueColor={kpis.unassigned > 0 ? '#c46a1c' : undefined}
        />
        <KpiCard
          label="Resolved this week"
          value={kpis.resolvedThisWeek}
          sub="Closed in last 7 days"
          valueColor={kpis.resolvedThisWeek > 0 ? '#4f8a5f' : undefined}
        />
      </div>

      {/* Filter bar */}
      <div className="card mb-4 reveal">
        <div className="flex flex-wrap items-center gap-3">
          <div className="segmented">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`segmented-btn ${statusFilter === s ? 'segmented-btn-active' : ''}`}
              >
                {s === 'all' ? 'All' : STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-3">
            <select
              className="input w-auto"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
              aria-label="Filter by priority"
            >
              <option value="all">All priorities</option>
              {(['urgent', 'high', 'medium', 'low'] as CasePriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>

            <select
              className="input w-auto"
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              aria-label="Filter by assignee"
            >
              <option value="all">All assignees</option>
              {ANALYSTS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
              <option value={UNASSIGNED}>Unassigned</option>
            </select>

            {hasFilters && (
              <button
                onClick={() => {
                  setStatusFilter('all')
                  setPriorityFilter('all')
                  setAssigneeFilter('all')
                }}
                className="btn btn-ghost"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card-flush reveal">
        <div className="flex items-center gap-2 px-6 py-5 border-b">
          <SlidersHorizontal size={16} style={{ color: 'var(--brand)' }} />
          <h2 className="section-title">
            {rows.length} {rows.length === 1 ? 'case' : 'cases'}
          </h2>
          <div className="ml-auto segmented">
            {(
              [
                ['priority', 'Priority'],
                ['sla', 'SLA'],
                ['age', 'Age'],
              ] as [SortKey, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={`segmented-btn inline-flex items-center gap-1 ${sort === key ? 'segmented-btn-active' : ''}`}
              >
                <ArrowUpDown size={12} /> {label}
              </button>
            ))}
          </div>
        </div>

        {cases.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <Inbox size={32} className="mx-auto mb-3" style={{ color: 'var(--text-faint)' }} />
            <p className="text-sm text-soft">No cases in the queue.</p>
            <p className="text-xs text-faint mt-1">
              Cases open automatically for players whose risk warrants action.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs" style={{ color: 'var(--text-faint)' }}>
                  <th className="px-5 py-3 font-semibold">Player</th>
                  <th className="px-3 py-3 font-semibold">Risk</th>
                  <th className="px-3 py-3 font-semibold">Priority</th>
                  <th className="px-3 py-3 font-semibold">Assignee</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">SLA</th>
                  <th className="px-5 py-3 font-semibold">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((c) => (
                  <CaseRow
                    key={c.id}
                    c={c}
                    assessment={assessments.get(c.playerId)}
                    active={c.id === selectedId}
                    onSelect={() => setSelectedId(c.id)}
                  />
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <div className="px-5 py-12 text-center text-sm text-faint">
                No cases match these filters.
              </div>
            )}
          </div>
        )}
      </div>

      {selected && (
        <CaseDetail
          c={selected}
          player={selectedPlayer}
          assessment={selectedAssessment}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
