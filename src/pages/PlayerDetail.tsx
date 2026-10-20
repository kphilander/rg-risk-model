import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowLeft, ArrowRight, ShieldCheck, TrendingUp, Zap, UserCog, FileText } from 'lucide-react'
import { RiskGauge } from '../components/RiskGauge'
import { MarkerBar } from '../components/MarkerBar'
import { RiskBadge } from '../components/RiskBadge'
import { InfoPopover } from '../components/InfoPopover'
import { InteractionLog } from '../components/InteractionLog'
import { Disclosure } from '../components/Disclosure'
import { InterventionModal } from '../components/InterventionModal'
import { useStore, useDataAsOf } from '../store/useStore'
import { denseTrend } from '../engine/scoring'
import { forecast } from '../engine/forecast'
import { counterfactual } from '../engine/counterfactual'
import { riskNarrative } from '../engine/narrative'
import { ESCALATION } from '../lib/riskBands'
import { useChartColors } from '../lib/useChartColors'
import { currency, shortDate, relativeTime } from '../lib/format'

// Unique short labels for the radar angle axis (duplicate categories break the
// polar scale, so each marker gets a distinct abbreviation).
const RADAR_LABEL: Record<string, string> = {
  'chasing-losses': 'Chasing',
  'increasing-bets': 'Bet ↑',
  'deposit-volatility': 'Dep. vol',
  'loss-of-winnings': 'Give-back',
  'payment-switching': 'Pay switch',
  'impulsive-transactions': 'Impulsive',
  'longer-sessions': 'Sessions',
  'play-frequency': 'Frequency',
  'late-night-play': 'Late-night',
  'faster-games': 'Fast games',
  'tolerance-for-loss': 'Tolerance',
  'inability-to-stop': "Can't stop",
  'deposit-escalation': 'Dep. freq',
}

export function PlayerDetail() {
  const { id } = useParams<{ id: string }>()
  const asOf = useDataAsOf()
  const player = useStore((s) => (id ? s.getPlayer(id) : undefined))
  const assessment = useStore((s) => (id ? s.getAssessment(id) : undefined))
  const stats = useStore((s) => s.stats)
  const c = useChartColors()
  const [modalOpen, setModalOpen] = useState(false)

  const trend = useMemo(() => (player ? denseTrend(player) : []), [player])

  if (!player || !assessment) {
    return (
      <div className="card text-center py-12">
        <p className="text-soft">Player not found.</p>
        <Link to="/players" className="btn btn-primary mt-4 inline-flex">
          Back to players
        </Link>
      </div>
    )
  }

  const escalation = ESCALATION[assessment.band.id]
  const fc = forecast(assessment)
  const cf = counterfactual(assessment.markers, assessment.score)
  const radarData = assessment.markers.map((m) => ({ marker: RADAR_LABEL[m.id] ?? m.label, score: m.score }))
  const trendData = trend.map((t) => ({ ...t, label: shortDate(t.date) }))
  const playedDays = player.activity.filter((d) => d.played)
  const recentDays = [...playedDays].slice(-10).reverse()
  const totalDeposits = playedDays.reduce((s, d) => s + d.deposits, 0)
  const totalNet = playedDays.reduce((s, d) => s + d.net, 0)

  return (
    <div>
      <Link to="/players" className="inline-flex items-center gap-1.5 text-sm font-semibold mb-4" style={{ color: 'var(--brand)' }}>
        <ArrowLeft size={15} /> All players
      </Link>

      {/* Header */}
      <div className="card">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex items-center gap-5 shrink-0">
            <RiskGauge score={assessment.score} band={assessment.band} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[26px] font-semibold tracking-[-0.03em]">{player.handle}</h1>
              <InfoPopover
                align="left"
                width={300}
                title={`${assessment.band.label} risk band`}
                triggerLabel={`About the ${assessment.band.label} risk band`}
                triggerClassName="focus-ring rounded-full"
                trigger={<RiskBadge band={assessment.band} />}
              >
                <p>{assessment.band.description}</p>
                <p className="text-faint">
                  Score range <b className="text-soft">{assessment.band.min}–{assessment.band.max}</b> · recommended{' '}
                  <b className="text-soft">Level {escalation.level} — {escalation.action}</b>.
                </p>
                <Link to="/governance" className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--brand)' }}>
                  Bands &amp; escalation <ArrowRight size={13} />
                </Link>
              </InfoPopover>
              <span className="chip">
                {assessment.peerPercentile}th percentile
              </span>
              {assessment.probability != null && (
                <span
                  className="chip"
                  title="Calibrated probability of the modelled harm proxy (RG-coded closure) within the next 12 months, from a discrete-time hazard fit to the reference cohort. This is the absolute-risk read; the 0–100 score is the ordinal index that drives the bands."
                >
                  ~{(assessment.probability * 100).toFixed(assessment.probability < 0.05 ? 1 : 0)}% risk · 12 mo
                </span>
              )}
              {assessment.observed && (
                <span className="chip" title="Score includes staff observations">
                  <UserCog size={12} />
                  {assessment.dataScore != null && assessment.score > assessment.dataScore
                    ? `+${assessment.score - assessment.dataScore} staff signal`
                    : 'staff signal'}
                </span>
              )}
            </div>
            <div className="mt-1.5 text-sm text-faint flex flex-wrap gap-x-4 gap-y-1">
              <span>{player.id}</span>
              <span>{player.country}</span>
              <span>{player.ageBand}</span>
              <span>Account {Math.round(player.accountAgeDays / 30)} mo</span>
              <span>Last active {relativeTime(player.lastActive, asOf)}</span>
            </div>

            {/* AI narrative */}
            <div className="mt-4 rounded-lg border p-3.5" style={{ background: 'var(--surface-2)' }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <FileText size={14} style={{ color: 'var(--brand)' }} />
                <span className="text-xs font-bold" style={{ color: 'var(--brand)' }}>
                  Assessment summary
                </span>
              </div>
              <p className="text-sm leading-relaxed text-soft">{riskNarrative(player, assessment)}</p>
            </div>
          </div>
        </div>

        {/* Recommended action banner */}
        <div
          className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg p-4"
          style={{ background: assessment.band.tint }}
        >
          <ShieldCheck size={20} style={{ color: assessment.band.color }} className="shrink-0" />
          <div className="flex-1">
            <div className="font-bold text-sm" style={{ color: assessment.band.color }}>
              Recommended: Level {escalation.level} — {escalation.action}
            </div>
            <div className="text-xs text-soft mt-0.5">{escalation.detail}</div>
          </div>
          <button onClick={() => setModalOpen(true)} className="btn btn-primary shrink-0">
            Log intervention
          </button>
        </div>
      </div>

      <div className="mt-4">
        <InteractionLog playerId={player.id} assessment={assessment} onLogIntervention={() => setModalOpen(true)} />
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend + activity */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} style={{ color: 'var(--brand)' }} />
              <h2 className="section-title">Data-derived risk over time</h2>
            </div>
            <p className="text-xs text-faint mt-0.5">Rolling 35-day data-derived assessment. The gauge above is the combined score (data + staff observations).</p>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pdArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={assessment.band.color} stopOpacity={0.32} />
                      <stop offset="100%" stopColor={assessment.band.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28} />
                  <YAxis domain={[0, 100]} tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 10, color: c.text, fontSize: 12 }}
                  />
                  <ReferenceLine y={stats.averageScore} stroke={c.axis} strokeDasharray="4 4" strokeOpacity={0.6} />
                  {assessment.observed && assessment.dataScore != null && assessment.score !== assessment.dataScore && (
                    <ReferenceLine
                      y={assessment.score}
                      stroke={assessment.band.color}
                      strokeWidth={1.5}
                      label={{
                        value: `Combined ${assessment.score}${assessment.observed.concern === 'open' ? ' · disclosure floor' : ''}`,
                        position: 'insideTopRight',
                        fill: assessment.band.color,
                        fontSize: 11,
                      }}
                    />
                  )}
                  <Area type="monotone" dataKey="score" stroke={assessment.band.color} strokeWidth={2.5} fill="url(#pdArea)" name="Data-derived score" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 text-[11px] text-faint">
              Dashed line = portfolio average ({stats.averageScore}).
              {assessment.observed && (assessment.observed.count > 0 || assessment.observed.concern !== 'none') && (
                <> Solid coloured line = combined score; {assessment.observed.count} staff observation{assessment.observed.count === 1 ? '' : 's'} fold in (see Player activity).</>
              )}
            </div>
          </div>

          {/* Trajectory forecast + counterfactual */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} style={{ color: fc.velocityPerWeek >= 0 ? '#d1432b' : '#3f8a55' }} />
                <h2 className="section-title">Trajectory forecast</h2>
              </div>
              <p className="text-xs text-faint mt-0.5 capitalize">{fc.trajectory} · {fc.velocityPerWeek >= 0 ? '+' : ''}{fc.velocityPerWeek} pts/week</p>
              <div className="mt-4 flex items-center gap-2">
                {[{ label: 'Now', s: fc.current, b: assessment.band }, { label: '30d', s: fc.projected30, b: fc.band30 }, { label: '60d', s: fc.projected60, b: fc.band60 }].map((step, i) => (
                  <div key={step.label} className="flex items-center gap-2 flex-1">
                    <div className="flex-1 rounded-lg px-2.5 py-2 text-center" style={{ background: 'var(--surface-2)' }}>
                      <div className="text-[10px] text-faint">{step.label}</div>
                      <div className="text-[20px] font-bold tabular-nums leading-tight mt-0.5" style={{ color: step.b.color }}>{step.s}</div>
                      <div className="text-[10px] font-medium" style={{ color: step.b.color }}>{step.b.label}</div>
                    </div>
                    {i < 2 && <ArrowRight size={13} className="text-faint shrink-0" />}
                  </div>
                ))}
              </div>
              {fc.earlyWarning && (
                <div className="mt-3 rounded-lg px-3 py-2 text-[12px] font-medium flex items-center gap-2" style={{ background: 'rgba(255,159,10,0.14)', color: '#c46a1c' }}>
                  <Zap size={14} /> Early warning — projected to reach High within 60 days.
                </div>
              )}
            </div>

            <div className="card">
              <div className="flex items-center gap-2">
                <FileText size={16} style={{ color: 'var(--brand)' }} />
                <h2 className="section-title">What would lower this</h2>
              </div>
              {cf ? (
                <>
                  <p className="text-xs text-faint mt-0.5">Minimal marker change to reach <span style={{ color: cf.targetBand.color }} className="font-semibold">{cf.targetBand.label}</span> (≤ {cf.threshold})</p>
                  <div className="mt-3 space-y-2">
                    {cf.changes.slice(0, 4).map((ch) => (
                      <div key={ch.id}>
                        <div className="flex items-center justify-between text-[13px]">
                          <span className="font-medium truncate pr-2">{ch.label}</span>
                          <span className="tabular-nums text-faint shrink-0">{ch.from} → <span className="font-semibold" style={{ color: 'var(--brand)' }}>{ch.to}</span></span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                          <div className="h-full rounded-full" style={{ width: `${ch.to}%`, background: 'var(--brand)' }} />
                          <div className="h-full rounded-full -mt-1.5" style={{ width: `${ch.from}%`, background: 'var(--brand)', opacity: 0.25 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] text-faint">{cf.achievable ? `Reducing these drops the score to ${cf.finalScore}.` : 'Not reachable by these markers alone.'}</p>
                </>
              ) : (
                <p className="text-sm text-soft mt-3">Already in the lowest band — no reduction needed.</p>
              )}
            </div>
          </div>

          {/* Recent activity — day-level detail, on demand */}
          <Disclosure
            title="Recent activity"
            summary={`last ${recentDays.length} active days · net ${currency(recentDays.reduce((s, d) => s + d.net, 0), player.currency)}`}
            flush
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs" style={{ color: 'var(--text-faint)' }}>
                    <th className="px-5 py-2.5 font-semibold">Date</th>
                    <th className="px-3 py-2.5 font-semibold">Sessions</th>
                    <th className="px-3 py-2.5 font-semibold">Time</th>
                    <th className="px-3 py-2.5 font-semibold">Avg stake</th>
                    <th className="px-3 py-2.5 font-semibold">Deposits</th>
                    <th className="px-3 py-2.5 font-semibold">Net</th>
                    <th className="px-5 py-2.5 font-semibold">Game</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentDays.map((d) => (
                    <tr key={d.date}>
                      <td className="px-5 py-2.5">{shortDate(d.date)}</td>
                      <td className="px-3 py-2.5 tabular-nums">{d.sessions}</td>
                      <td className="px-3 py-2.5 tabular-nums">{d.minutes}m</td>
                      <td className="px-3 py-2.5 tabular-nums">{currency(d.avgStake, player.currency)}</td>
                      <td className="px-3 py-2.5 tabular-nums">{d.deposits > 0 ? currency(d.deposits, player.currency) : '—'}</td>
                      <td className="px-3 py-2.5 tabular-nums font-medium" style={{ color: d.net < 0 ? '#d1432b' : '#4f8a5f' }}>
                        {currency(d.net, player.currency)}
                      </td>
                      <td className="px-5 py-2.5">
                        <span className="chip !py-0.5 capitalize">{d.gameSpeed}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Disclosure>
        </div>

        {/* Markers + radar + peer + history */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-title">Behavioral signature</h2>
            <div className="h-56 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke={c.grid} />
                  <PolarAngleAxis dataKey="marker" tick={{ fill: c.axis, fontSize: 9 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} tickCount={5} />
                  <Radar dataKey="score" stroke={assessment.band.color} fill={assessment.band.color} fillOpacity={0.3} isAnimationActive={false} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h2 className="section-title">Money snapshot</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Stat label="Total deposits" value={currency(totalDeposits, player.currency)} />
              <Stat label="Net result" value={currency(totalNet, player.currency)} negative={totalNet < 0} />
              <Stat label="Active days" value={`${playedDays.length} / 92`} />
              <Stat label="Currency" value={player.currency} />
            </div>
          </div>
        </div>
      </div>

      {/* Full marker breakdown — the radar above gives the shape; the full
          13-marker evidence expands on demand */}
      <div className="mt-4">
        <Disclosure
          title="Risk marker breakdown"
          summary={`all 13 indicators · led by ${assessment.topMarkers[0].label.toLowerCase()} (${Math.round(assessment.topMarkers[0].score)})`}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 divide-y md:divide-y-0">
            {assessment.markers.map((m) => (
              <MarkerBar key={m.id} marker={m} />
            ))}
          </div>
        </Disclosure>
      </div>

      {modalOpen && (
        <InterventionModal player={player} assessment={assessment} onClose={() => setModalOpen(false)} />
      )}
    </div>
  )
}

function Stat({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="rounded-lg border p-3" style={{ background: 'var(--surface-2)' }}>
      <div className="text-[11px] text-faint">{label}</div>
      <div className="font-bold tabular-nums mt-0.5" style={{ color: negative ? '#d1432b' : 'var(--text)' }}>
        {value}
      </div>
    </div>
  )
}
