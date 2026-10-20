import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, X, ArrowUpDown, SlidersHorizontal } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { RiskBadge } from '../components/RiskBadge'
import { Sparkline } from '../components/Sparkline'
import { Pager } from '../components/Pager'
import { useStore, useDataAsOf } from '../store/useStore'
import { RISK_BANDS } from '../lib/riskBands'
import { JURISDICTIONS } from '../data/pools'
import { relativeTime } from '../lib/format'

const PAGE_SIZE = 25

export function Players() {
  const players = useStore((s) => s.players)
  const asOf = useDataAsOf()
  const assessments = useStore((s) => s.assessments)
  const filters = useStore((s) => s.filters)
  const setFilters = useStore((s) => s.setFilters)
  const resetFilters = useStore((s) => s.resetFilters)
  const navigate = useNavigate()
  const [page, setPage] = useState(0)

  const rows = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    let list = players.map((p) => ({ p, a: assessments.get(p.id)! }))

    if (q) list = list.filter(({ p }) => p.handle.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
    if (filters.bands.length) list = list.filter(({ a }) => filters.bands.includes(a.band.id))
    if (filters.jurisdiction !== 'all') list = list.filter(({ p }) => p.jurisdiction === filters.jurisdiction)

    const dir = filters.sortDir === 'asc' ? 1 : -1
    list.sort((x, y) => {
      switch (filters.sort) {
        case 'delta':
          return (x.a.delta7d - y.a.delta7d) * dir
        case 'lastActive':
          return (x.p.lastActive < y.p.lastActive ? -1 : 1) * dir
        case 'handle':
          return x.p.handle.localeCompare(y.p.handle) * dir
        default:
          return (x.a.score - y.a.score) * dir
      }
    })
    return list
  }, [players, assessments, filters])

  // Return to the first page whenever the result set changes.
  useEffect(() => setPage(0), [filters])
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const toggleBand = (id: string) => {
    const bands = filters.bands.includes(id)
      ? filters.bands.filter((b) => b !== id)
      : [...filters.bands, id]
    setFilters({ bands })
  }

  const setSort = (sort: typeof filters.sort) => {
    if (filters.sort === sort) setFilters({ sortDir: filters.sortDir === 'asc' ? 'desc' : 'asc' })
    else setFilters({ sort, sortDir: 'desc' })
  }

  const hasFilters = filters.search || filters.bands.length || filters.jurisdiction !== 'all'

  return (
    <div>
      <PageHeader
        title="Players"
        subtitle={`${rows.length.toLocaleString()} of ${players.length.toLocaleString()} players match your filters`}
      />

      {/* Filter bar */}
      <div className="card mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
            <input
              className="input pl-9"
              placeholder="Search by handle or player ID…"
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
            />
          </div>

          <select
            className="input w-auto"
            value={filters.jurisdiction}
            onChange={(e) => setFilters({ jurisdiction: e.target.value })}
            aria-label="Filter by jurisdiction"
          >
            <option value="all">All jurisdictions</option>
            {JURISDICTIONS.map((j) => (
              <option key={j.code} value={j.code}>
                {j.country}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button onClick={resetFilters} className="btn btn-ghost">
              <X size={15} /> Clear
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-faint mr-1">
            <SlidersHorizontal size={13} /> Risk band
          </span>
          {RISK_BANDS.map((b) => {
            const active = filters.bands.includes(b.id)
            return (
              <button
                key={b.id}
                onClick={() => toggleBand(b.id)}
                className="rounded-full border px-3 py-1 text-xs font-semibold transition"
                style={
                  active
                    ? { background: b.tint, color: b.color, borderColor: b.color }
                    : { background: 'var(--surface)', color: 'var(--text-soft)' }
                }
              >
                {b.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div className="card-flush overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: 'var(--text-faint)' }}>
              <Th onClick={() => setSort('handle')} active={filters.sort === 'handle'}>
                Player
              </Th>
              <Th onClick={() => setSort('score')} active={filters.sort === 'score'} className="w-px">
                Risk score
              </Th>
              <th className="px-4 py-3 font-semibold hidden sm:table-cell">Top driver</th>
              <th className="px-4 py-3 font-semibold hidden md:table-cell">Trend</th>
              <Th onClick={() => setSort('delta')} active={filters.sort === 'delta'} className="hidden sm:table-cell">
                7-day Δ
              </Th>
              <Th onClick={() => setSort('lastActive')} active={filters.sort === 'lastActive'} className="hidden lg:table-cell">
                Last active
              </Th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pageRows.map(({ p, a }) => (
              <tr
                key={p.id}
                className="group cursor-pointer transition-colors hover:bg-[var(--surface-2)]"
                onClick={() => navigate(`/players/${p.id}`)}
              >
                <td className="px-4 py-3">
                  <Link to={`/players/${p.id}`} className="block">
                    <div className="font-semibold group-hover:underline">{p.handle}</div>
                    <div className="text-xs text-faint">
                      {p.id} · {p.country}
                    </div>
                    <div className="sm:hidden text-xs text-faint mt-0.5">{a.topMarkers[0].label}</div>
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <RiskBadge band={a.band} score={a.score} />
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <div className="text-sm">{a.topMarkers[0].label}</div>
                  <div className="text-xs text-faint">{a.topMarkers[0].value}</div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <Sparkline data={a.trend.map((t) => t.score)} color={a.band.color} />
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <DeltaChip value={a.delta7d} />
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-faint text-xs">
                  {relativeTime(p.lastActive, asOf)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-faint">No players match your filters.</div>
        )}
        <Pager page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} noun="players" />
      </div>
    </div>
  )
}

function Th({
  children,
  onClick,
  active,
  className = '',
}: {
  children: React.ReactNode
  onClick: () => void
  active: boolean
  className?: string
}) {
  return (
    <th className={`px-4 py-3 font-semibold ${className}`}>
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 hover:opacity-80"
        style={{ color: active ? 'var(--brand)' : 'inherit' }}
      >
        {children}
        <ArrowUpDown size={12} />
      </button>
    </th>
  )
}

function DeltaChip({ value }: { value: number }) {
  if (Math.abs(value) < 1) return <span className="text-xs text-faint">—</span>
  const up = value > 0
  return (
    <span className="text-xs font-semibold tabular-nums" style={{ color: up ? '#d1432b' : '#4f8a5f' }}>
      {up ? '+' : ''}
      {value}
    </span>
  )
}
