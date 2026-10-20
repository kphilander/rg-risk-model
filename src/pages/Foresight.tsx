import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, TrendingUp, TrendingDown, Zap } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { KpiCard } from '../components/KpiCard'
import { RiskBadge } from '../components/RiskBadge'
import { Sparkline } from '../components/Sparkline'
import { useStore } from '../store/useStore'
import { forecast, type Forecast } from '../engine/forecast'
import type { PlayerProfile, RiskAssessment } from '../types'

interface Row {
  p: PlayerProfile
  a: RiskAssessment
  f: Forecast
}

const TRAJ_COLOR: Record<string, string> = {
  surging: '#d1432b',
  rising: '#c46a1c',
  stable: '#8e8e93',
  improving: '#3f8a55',
}

export function Foresight() {
  const players = useStore((s) => s.players)
  const assessments = useStore((s) => s.assessments)

  const rows = useMemo<Row[]>(
    () =>
      players
        .map((p) => ({ p, a: assessments.get(p.id)! }))
        .filter((x) => x.a)
        .map((x) => ({ ...x, f: forecast(x.a) })),
    [players, assessments],
  )

  const earlyWarnings = useMemo(
    () => rows.filter((r) => r.f.earlyWarning).sort((a, b) => b.f.velocityPerWeek - a.f.velocityPerWeek),
    [rows],
  )
  const accelerating = useMemo(
    () => [...rows].sort((a, b) => b.f.velocityPerWeek - a.f.velocityPerWeek).slice(0, 8),
    [rows],
  )
  const surging = rows.filter((r) => r.f.trajectory === 'surging').length
  const improving = rows.filter((r) => r.f.trajectory === 'improving').length
  const meanVel =
    rows.length > 0 ? rows.reduce((s, r) => s + r.f.velocityPerWeek, 0) / rows.length : 0

  return (
    <div>
      <PageHeader
        title="Foresight"
        subtitle="Risk velocity and 30/60-day projections, with a watchlist of players trending toward High."
      />

      <div className="kpi-strip">
        <KpiCard label="Early warnings" value={earlyWarnings.length} valueColor="#c46a1c" sub="below High now → High/Critical in 60d" />
        <KpiCard label="Surging" value={surging} valueColor="#d1432b" sub="risk rising ≥3 pts / week" />
        <KpiCard label="De-escalating" value={improving} valueColor="#3f8a55" sub="risk falling week-on-week" />
        <KpiCard label="Mean velocity" value={`${meanVel >= 0 ? '+' : ''}${meanVel.toFixed(1)}`} sub="avg change / week, portfolio" />
      </div>

      {/* Early-warning watchlist */}
      <div className="card-flush mt-5 reveal">
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--hairline)' }}>
          <div className="flex items-center gap-2">
            <Zap size={17} style={{ color: '#c46a1c' }} />
            <h2 className="section-title">Early-warning watchlist</h2>
          </div>
          <span className="text-[13px] text-faint tabular-nums">{earlyWarnings.length} players</span>
        </div>
        {earlyWarnings.length === 0 ? (
          <div className="px-6 py-10 text-center text-[13px] text-faint">No players are on an escalating path into High/Critical right now.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--hairline)' }}>
            {earlyWarnings.slice(0, 12).map(({ p, a, f }) => (
              <Link key={p.id} to={`/players/${p.id}`} className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-[var(--surface-2)]" style={{ borderColor: 'var(--hairline)' }}>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate tracking-[-0.01em]">{p.handle}</div>
                  <div className="text-[13px] text-faint mt-0.5">{p.country} · {a.topMarkers[0].label}</div>
                </div>
                <Sparkline data={a.trend.map((t) => t.score)} color={TRAJ_COLOR[f.trajectory]} />
                <div className="hidden sm:flex items-center gap-1 text-[13px] font-semibold tabular-nums shrink-0" style={{ color: '#d1432b' }}>
                  <TrendingUp size={14} />+{f.velocityPerWeek}/wk
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <RiskBadge band={a.band} score={a.score} />
                  <ArrowRight size={13} className="text-faint" />
                  <RiskBadge band={f.band60} score={f.projected60} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Velocity leaderboard */}
      <div className="card mt-5 reveal">
        <h2 className="section-title">Risk velocity leaderboard</h2>
        <p className="section-sub">Fastest-accelerating players · projected band in 60 days</p>
        <div className="mt-4 space-y-1.5">
          {accelerating.map(({ p, f }) => {
            const rising = f.velocityPerWeek >= 0
            return (
              <Link key={p.id} to={`/players/${p.id}`} className="lift flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ background: 'var(--surface-2)' }}>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold truncate">{p.handle}</div>
                  <div className="text-[12px] text-faint capitalize">{f.trajectory} · {p.country}</div>
                </div>
                <div className="flex items-center gap-1 text-[13px] font-semibold tabular-nums w-20 justify-end" style={{ color: rising ? '#d1432b' : '#3f8a55' }}>
                  {rising ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {rising ? '+' : ''}{f.velocityPerWeek}
                </div>
                <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                  <span className="text-[12px] tabular-nums text-faint">{f.current}</span>
                  <ArrowRight size={12} className="text-faint" />
                  <span className="text-[13px] font-bold tabular-nums" style={{ color: f.band60.color }}>{f.projected60}</span>
                </div>
              </Link>
            )
          })}
        </div>
        <p className="mt-4 text-[12px] text-faint">Projections extrapolate recent velocity linearly. Treat a single week's slope with caution.</p>
      </div>
    </div>
  )
}
