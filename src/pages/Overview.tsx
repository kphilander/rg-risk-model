import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowRight } from 'lucide-react'
import { KpiCard } from '../components/KpiCard'
import { RiskBadge } from '../components/RiskBadge'
import { Sparkline } from '../components/Sparkline'
import { useStore, useDataAsOf } from '../store/useStore'
import { INTERACTION_KIND_LABELS, OBSERVED_MARKERS } from '../core/observedMarkers'
import { RISK_BANDS, bandForScore } from '../lib/riskBands'
import { domainForMarker } from '../lib/markerDomains'
import { useChartColors } from '../lib/useChartColors'
import { shortDate, relativeTime } from '../lib/format'
import { InfoPopover } from '../components/InfoPopover'
import { OnboardingChecklist } from '../components/OnboardingChecklist'
import { MARKER_INFO } from '../content/markerInfo'
import { MODEL_CARD } from '../lib/modelCard'

export function Overview() {
  const players = useStore((s) => s.players)
  const assessments = useStore((s) => s.assessments)
  const stats = useStore((s) => s.stats)
  const interventions = useStore((s) => s.interventions)
  const interactions = useStore((s) => s.interactions)
  const asOf = useDataAsOf()

  // One activity feed: logged interventions (wall-clock) + staff observations
  // (data time), newest first.
  const activity = useMemo(() => {
    const handle = new Map(players.map((p) => [p.id, p.handle]))
    const markerLabel = new Map(OBSERVED_MARKERS.map((m) => [m.slug, m.label]))
    const items = [
      ...interventions.map((i) => ({
        key: i.id, playerId: i.playerId, handle: i.playerHandle, ts: i.timestamp, data: false,
        kind: `L${i.level} intervention`, detail: i.action,
      })),
      ...interactions.map((ix) => ({
        key: ix.id, playerId: ix.playerId, handle: handle.get(ix.playerId) ?? ix.playerId, ts: ix.timestamp, data: true,
        kind: INTERACTION_KIND_LABELS[ix.kind],
        detail: ix.markers.map((m) => markerLabel.get(m) ?? m).join(', ') || ix.note,
      })),
    ]
    return items.sort((a, b) => (a.ts < b.ts ? 1 : -1)).slice(0, 12)
  }, [interventions, interactions, players])
  const setFilters = useStore((s) => s.setFilters)
  const c = useChartColors()

  const ranked = useMemo(
    () =>
      players
        .map((p) => ({ p, a: assessments.get(p.id)! }))
        .sort((x, y) => y.a.score - x.a.score),
    [players, assessments],
  )

  const topRisk = ranked.slice(0, 6)
  const markerData = stats.topMarkers.slice(0, 7).map((m) => ({ ...m, avg: Math.round(m.avg) }))
  const maxAvg = Math.max(...markerData.map((m) => m.avg), 1)
  const openInterventions = interventions.filter((i) => i.status === 'logged').length
  const rising = ranked.filter(({ a }) => (a.delta7d ?? 0) > 0).length
  const avgBand = bandForScore(stats.averageScore)

  const trendData = stats.trend.map((t) => ({ ...t, label: shortDate(t.date) }))

  return (
    <div>
      <OnboardingChecklist />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="large-title">Portfolio overview</h1>
          <p className="mt-1.5 text-[13.5px] text-soft">
            {stats.totalPlayers.toLocaleString()} monitored players · 0–100 behavioural risk index over a rolling 92-day window
          </p>
        </div>
        <Link to="/governance" className="text-[12.5px] font-medium inline-flex items-center gap-1" style={{ color: 'var(--accent)' }}>
          Model &amp; methodology <ArrowRight size={13} />
        </Link>
      </div>

      {/* Summary strip */}
      <div className="kpi-strip" style={{ ['--kpi-cols' as string]: 5 }}>
        <KpiCard
          label="Portfolio risk index"
          value={
            <span className="inline-flex items-baseline gap-2">
              {stats.averageScore}
              <span className="text-[13px] text-faint">/ 100</span>
            </span>
          }
          sub={`Mean player score · ${avgBand.label}`}
          valueColor={avgBand.color}
          to="/governance"
        />
        <KpiCard
          label="Monitored players"
          value={stats.totalPlayers.toLocaleString()}
          sub={`${stats.activePlayers.toLocaleString()} active in last 14 days`}
          to="/players"
          onClick={() => setFilters({ bands: [], jurisdiction: 'all', search: '' })}
        />
        <KpiCard
          label="High & critical"
          value={stats.highRiskCount}
          valueColor="#d1432b"
          sub={`${((stats.highRiskCount / stats.totalPlayers) * 100).toFixed(1)}% of portfolio`}
          to="/players"
          onClick={() => setFilters({ bands: ['high', 'critical'] })}
        />
        <KpiCard
          label="Rising · 7-day"
          value={rising}
          valueColor="#c46a1c"
          sub="players trending upward"
          to="/foresight"
        />
        <KpiCard
          label="Interventions logged"
          value={interventions.length}
          sub={`${openInterventions} open in audit trail`}
          to="/compliance"
        />
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Portfolio risk trend */}
        <div className="card lg:col-span-2 reveal">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title">Portfolio risk trend</h2>
              <p className="section-sub">Mean risk score across the portfolio</p>
            </div>
            <RiskBadge band={avgBand} score={stats.averageScore} />
          </div>
          <div className="mt-5 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="riskArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.brand} stopOpacity={0.22} />
                    <stop offset="90%" stopColor={c.brand} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={c.grid} strokeWidth={1} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28} dy={6} />
                <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
                <Tooltip
                  cursor={{ stroke: c.tooltipBorder, strokeWidth: 1 }}
                  contentStyle={{
                    background: c.tooltipBg,
                    border: `1px solid ${c.tooltipBorder}`,
                    borderRadius: 12,
                    color: c.text,
                    fontSize: 12,
                    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                  }}
                />
                <Area type="monotone" dataKey="score" stroke={c.brand} strokeWidth={2.25} fill="url(#riskArea)" name="Mean score" isAnimationActive={false} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Band distribution */}
          <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--hairline)' }}>
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="section-title">Risk band distribution</h3>
              <span className="text-[13px] text-faint tabular-nums">{stats.totalPlayers.toLocaleString()} players</span>
            </div>
            <div className="flex h-2.5 w-full gap-1">
              {RISK_BANDS.map((b) => {
                const count = stats.bandCounts[b.id]
                const pct = (count / stats.totalPlayers) * 100
                return (
                  <Link
                    key={b.id}
                    to="/players"
                    onClick={() => setFilters({ bands: [b.id] })}
                    className="rounded-full origin-bottom transition-transform hover:scale-y-[1.6]"
                    style={{ width: `${pct}%`, background: b.color }}
                    title={`${b.label}: ${count} — view players`}
                  />
                )
              })}
            </div>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
              {RISK_BANDS.map((b) => (
                <Link
                  key={b.id}
                  to="/players"
                  onClick={() => setFilters({ bands: [b.id] })}
                  className="focus-ring flex items-center gap-2.5 rounded-lg -mx-1.5 px-1.5 py-1 transition-colors hover:bg-[var(--surface-2)]"
                  title={`View ${b.label} players`}
                >
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: b.color }} />
                  <div className="leading-tight">
                    <div className="text-[17px] font-semibold tabular-nums" style={{ letterSpacing: '-0.02em' }}>{stats.bandCounts[b.id]}</div>
                    <div className="text-[11px] text-faint mt-0.5">{b.label}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Top risk drivers — domain rows */}
        <div className="card reveal">
          <h2 className="section-title">Top risk drivers</h2>
          <p className="section-sub">Avg. marker contribution · colour = domain</p>
          <div className="mt-4 space-y-1.5">
            {markerData.map((m) => {
              const domain = domainForMarker(m.id)
              const tier = bandForScore(m.avg * 2)
              const ev = MODEL_CARD.markers.find((x) => x.id === m.id)
              return (
                <InfoPopover
                  key={m.id}
                  align="right"
                  width={300}
                  title={m.label}
                  triggerLabel={`About “${m.label}”`}
                  block
                  triggerClassName="focus-ring block w-full text-left rounded-md px-2 py-2 -mx-2 transition-colors hover:bg-[var(--surface-2)]"
                  trigger={
                    <>
                      <div className="flex items-center gap-2.5">
                        <span className="h-2 w-2 rounded-[2px] shrink-0" style={{ background: domain.color }} />
                        <div className="flex-1 min-w-0 text-[13px] truncate">{m.label}</div>
                        <div className="text-[12.5px] font-mono tabular-nums" style={{ color: 'var(--text)' }} title={tier.label}>{m.avg}</div>
                      </div>
                      <div className="mt-1.5 ml-[18px] h-[3px] overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                        <div className="h-full" style={{ width: `${(m.avg / maxAvg) * 100}%`, background: domain.color }} />
                      </div>
                    </>
                  }
                >
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: domain.color }} />
                    <span className="text-[11px] font-semibold text-faint">
                      {domain.label} · avg {m.avg}/100
                    </span>
                  </div>
                  {MARKER_INFO[m.id] && <p>{MARKER_INFO[m.id]}</p>}
                  {ev && (
                    <p className="text-faint">
                      Weight <b className="text-soft">{ev.weight.toFixed(2)}</b> ·{' '}
                      {ev.fitted ? `fitted${ev.auc != null ? ` (AUC ${ev.auc.toFixed(2)})` : ''}` : 'informed prior'} · {ev.source}
                    </p>
                  )}
                  <Link to="/governance" className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--brand)' }}>
                    View model card <ArrowRight size={13} />
                  </Link>
                </InfoPopover>
              )
            })}
          </div>
          <div className="mt-4 pt-4 flex flex-wrap gap-x-4 gap-y-1.5" style={{ borderTop: '1px solid var(--hairline)' }}>
            {['financial', 'temporal', 'control'].map((id) => {
              const d = domainForMarker(id === 'financial' ? 'chasing-losses' : id === 'temporal' ? 'late-night-play' : 'inability-to-stop')
              return (
                <span key={id} className="inline-flex items-center gap-1.5 text-[11px] text-faint">
                  <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                  {d.label}
                </span>
              )
            })}
          </div>
        </div>
      </div>

      {/* Highest-risk players + recent activity */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5 reveal">
        <div className="card-flush lg:col-span-2">
          <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--hairline)' }}>
            <h2 className="section-title">Highest-risk players</h2>
            <Link to="/players" className="text-[13px] font-semibold inline-flex items-center gap-1 transition-opacity hover:opacity-70" style={{ color: 'var(--brand)' }}>
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div style={{ borderColor: 'var(--hairline)' }} className="divide-y">
            {topRisk.map(({ p, a }) => (
              <Link
                key={p.id}
                to={`/players/${p.id}`}
                className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-[var(--surface-2)]"
                style={{ borderColor: 'var(--hairline)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate tracking-[-0.01em]">{p.handle}</div>
                  <div className="text-[13px] text-faint mt-0.5">
                    {p.country} · {a.topMarkers[0].label}
                  </div>
                </div>
                <Sparkline data={a.trend.map((t) => t.score)} color={a.band.color} />
                <RiskBadge band={a.band} score={a.score} />
              </Link>
            ))}
          </div>
        </div>

        <div className="card-flush">
          <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--hairline)' }}>
            <h2 className="section-title">Recent activity</h2>
          </div>
          <div className="divide-y max-h-[360px] overflow-y-auto" style={{ borderColor: 'var(--hairline)' }}>
            {activity.length === 0 && (
              <div className="px-6 py-10 text-center text-[13px] text-faint">
                No activity logged yet.<br />Open a player profile to record an observation or intervention.
              </div>
            )}
            {activity.map((i) => (
              <Link
                key={i.key}
                to={`/players/${i.playerId}`}
                className="block px-6 py-3 transition-colors hover:bg-[var(--surface-2)]"
                style={{ borderColor: 'var(--hairline)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[14px] truncate">{i.handle}</span>
                  <span className="text-[11px] text-faint shrink-0 tabular-nums">{relativeTime(i.ts, i.data ? asOf : null)}</span>
                </div>
                <div className="text-[12.5px] text-soft mt-0.5 truncate">
                  <span className="font-medium" style={{ color: 'var(--text)' }}>{i.kind}</span> · {i.detail}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
