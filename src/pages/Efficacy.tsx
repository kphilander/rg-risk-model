import { useMemo, useState } from 'react'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { Activity, Info } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { KpiCard } from '../components/KpiCard'
import { RiskBadge } from '../components/RiskBadge'
import { BeforeAfterRow } from '../components/efficacy/BeforeAfterRow'
import { useStore } from '../store/useStore'
import { bandForScore } from '../lib/riskBands'
import { useChartColors } from '../lib/useChartColors'
import { buildInterventionOutcomes } from '../data/outcomes'

const POSITIVE = '#3f8a55'
const NEGATIVE = '#d1432b'

const LEVEL_ACTION: Record<number, string> = {
  1: 'Automated monitoring',
  2: 'Self-help nudge',
  3: 'Operator outreach',
  4: 'Apply controls',
  5: 'Support referral',
}

/** Green→amber ramp keyed on the size of the average risk drop, so bigger
 *  reductions read as more effective at a glance. */
function magnitudeColor(delta: number): string {
  if (delta >= 22) return '#3f8a55'
  if (delta >= 15) return '#5cc95a'
  if (delta >= 9) return '#a8c545'
  if (delta >= 4) return '#a3841a'
  return '#c46a1c'
}

export function Efficacy() {
  const players = useStore((s) => s.players)
  const assessments = useStore((s) => s.assessments)
  const c = useChartColors()
  const [levelFilter, setLevelFilter] = useState<number | 'all'>('all')

  const outcomes = useMemo(
    () => buildInterventionOutcomes(players, assessments),
    [players, assessments],
  )

  // Per-level aggregates: mean risk reduction, response rate, pre/post means.
  const byLevel = useMemo(() => {
    const levels = [1, 2, 3, 4, 5]
    return levels.map((level) => {
      const rows = outcomes.filter((o) => o.level === level)
      const n = rows.length
      const meanDelta = n ? rows.reduce((s, o) => s + o.delta, 0) / n : 0
      const responders = rows.filter((o) => o.delta > 0).length
      const responseRate = n ? (responders / n) * 100 : 0
      const meanPre = n ? rows.reduce((s, o) => s + o.preRisk, 0) / n : 0
      const meanPost = n ? rows.reduce((s, o) => s + o.postRisk, 0) / n : 0
      return {
        level,
        name: `L${level}`,
        action: LEVEL_ACTION[level],
        n,
        meanDelta: Math.round(meanDelta * 10) / 10,
        responseRate: Math.round(responseRate),
        meanPre: Math.round(meanPre),
        meanPost: Math.round(meanPost),
      }
    })
  }, [outcomes])

  // Headline KPIs.
  const kpis = useMemo(() => {
    const n = outcomes.length
    const meanDelta = n ? outcomes.reduce((s, o) => s + o.delta, 0) / n : 0
    const responders = outcomes.filter((o) => o.delta > 0).length
    const responseRate = n ? (responders / n) * 100 : 0
    // Best-performing level = highest mean risk reduction among levels with
    // enough interventions to compare (n >= MIN_N); fall back to any data.
    const MIN_N = 5
    const comparable = byLevel.filter((l) => l.n >= MIN_N)
    const withData = comparable.length ? comparable : byLevel.filter((l) => l.n > 0)
    const best = withData.reduce(
      (acc, l) => (l.meanDelta > acc.meanDelta ? l : acc),
      withData[0] ?? { level: 0, meanDelta: 0, action: '—', n: 0 },
    )
    return {
      n,
      meanDelta: Math.round(meanDelta * 10) / 10,
      responseRate: Math.round(responseRate),
      responders,
      best,
    }
  }, [outcomes, byLevel])

  // Scatter of pre vs post risk (below the diagonal = risk fell).
  const scatter = useMemo(
    () =>
      outcomes.map((o) => ({
        x: o.preRisk,
        y: o.postRisk,
        level: o.level,
        responded: o.responded,
        handle: o.handle,
      })),
    [outcomes],
  )

  // Recent outcomes, newest first, filtered by the chosen level.
  const recent = useMemo(() => {
    const rows = [...outcomes].sort((a, b) => a.daysAgo - b.daysAgo)
    return levelFilter === 'all' ? rows : rows.filter((o) => o.level === levelFilter)
  }, [outcomes, levelFilter])

  const maxDelta = Math.max(...byLevel.map((l) => l.meanDelta), 10)

  return (
    <div>
      <PageHeader
        title="Intervention efficacy"
        subtitle="Observed risk before and after intervention, broken out by escalation level."
      />

      {/* Headline KPIs */}
      <div className="kpi-strip">
        <KpiCard
          label="Interventions analysed"
          value={kpis.n.toLocaleString()}
          sub="With observed pre & post risk"
        />
        <KpiCard
          label="Mean risk reduction"
          value={
            <span>
              {kpis.meanDelta > 0 ? '−' : ''}
              {Math.abs(kpis.meanDelta)}
              <span className="text-[17px] font-medium text-faint"> pts</span>
            </span>
          }
          valueColor={POSITIVE}
          sub="Average drop in risk score"
        />
        <KpiCard
          label="Response rate"
          value={`${kpis.responseRate}%`}
          valueColor={kpis.responseRate >= 50 ? POSITIVE : '#c46a1c'}
          sub={`${kpis.responders} of ${kpis.n} saw risk fall`}
        />
        <KpiCard
          label="Best-performing level"
          value={kpis.best.level ? `L${kpis.best.level}` : '—'}
          valueColor={POSITIVE}
          sub={kpis.best.level ? `${kpis.best.action} · −${kpis.best.meanDelta} pts avg · n=${kpis.best.n}` : 'No data'}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Effectiveness by escalation level */}
        <div className="card lg:col-span-2 reveal">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="section-title">Effectiveness by escalation level</h2>
              <p className="section-sub">Mean risk reduction (bars) vs. response rate (line)</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-faint">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: magnitudeColor(maxDelta) }} />
                Risk drop
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-3 rounded-full" style={{ background: c.brand }} />
                Response %
              </span>
            </div>
          </div>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={byLevel} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={c.grid} strokeWidth={1} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: c.axis, fontSize: 12, fontWeight: 600 }}
                  tickLine={false}
                  axisLine={false}
                  dy={6}
                />
                <YAxis
                  yAxisId="left"
                  domain={[0, Math.ceil(maxDelta / 5) * 5]}
                  ticks={Array.from({ length: 5 }, (_, i) => (Math.ceil(maxDelta / 5) * 5 * i) / 4)}
                  tickFormatter={(v: number) => String(Math.round(v))}
                  tick={{ fill: c.axis, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  ticks={[0, 50, 100]}
                  tick={{ fill: c.axis, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={34}
                  unit="%"
                />
                <Tooltip
                  cursor={{ fill: 'var(--surface-2)', opacity: 0.5 }}
                  contentStyle={{
                    background: c.tooltipBg,
                    border: `1px solid ${c.tooltipBorder}`,
                    borderRadius: 12,
                    color: c.text,
                    fontSize: 12,
                    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                  }}
                  formatter={(value: number, name: string) =>
                    name === 'Response rate'
                      ? [`${value}%`, name]
                      : [`−${value} pts`, name]
                  }
                  labelFormatter={(label: string) => {
                    const row = byLevel.find((l) => l.name === label)
                    return row ? `${label} · ${row.action} (n=${row.n})` : label
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="meanDelta"
                  name="Mean risk reduction"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={54}
                  isAnimationActive={false}
                >
                  {byLevel.map((l) => (
                    <Cell key={l.level} fill={magnitudeColor(l.meanDelta)} />
                  ))}
                </Bar>
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="responseRate"
                  name="Response rate"
                  stroke={c.brand}
                  strokeWidth={2.25}
                  dot={{ r: 3.5, strokeWidth: 0, fill: c.brand }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-4 pt-4 text-[12px] leading-relaxed text-soft" style={{ borderTop: '1px solid var(--hairline)' }}>
            Higher escalation levels shift risk further and succeed more often. Bars show the average
            fall in risk; the line shows how often each level produced any fall at all.
          </p>
        </div>

        {/* Before → after, per level */}
        <div className="card reveal">
          <h2 className="section-title">Before → after</h2>
          <p className="section-sub">Average risk, per escalation level</p>
          <div className="mt-4 space-y-2">
            {byLevel.map((l) =>
              l.n > 0 ? (
                <BeforeAfterRow
                  key={l.level}
                  level={l.level}
                  action={l.action}
                  pre={l.meanPre}
                  post={l.meanPost}
                  count={l.n}
                />
              ) : null,
            )}
          </div>
          <div className="mt-4 pt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-faint" style={{ borderTop: '1px solid var(--hairline)' }}>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full" style={{ background: 'var(--surface)', boxShadow: 'inset 0 0 0 2.5px var(--text-faint)' }} />
              Before
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full" style={{ background: 'var(--text-faint)', boxShadow: '0 0 0 2px var(--surface)' }} />
              After
            </span>
          </div>
        </div>
      </div>

      {/* Pre vs post scatter — honest, non-responders visible above the line */}
      <div className="mt-5 card reveal">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="section-title">Pre vs. post risk</h2>
            <p className="section-sub">
              Each dot is one intervention. Below the diagonal = risk fell; on or above it = no
              improvement.
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-faint">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: POSITIVE }} />
              Responded
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: NEGATIVE }} />
              No response
            </span>
          </div>
        </div>
        <div className="mt-5 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={c.grid} strokeWidth={1} />
              <XAxis
                type="number"
                dataKey="x"
                name="Before"
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tick={{ fill: c.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                dy={4}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="After"
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tick={{ fill: c.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <ZAxis type="number" range={[46, 46]} />
              {/* y = x diagonal: "no change" reference */}
              <ReferenceLine
                segment={[
                  { x: 0, y: 0 },
                  { x: 100, y: 100 },
                ]}
                stroke={c.axis}
                strokeDasharray="4 4"
                strokeWidth={1}
                ifOverflow="hidden"
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3', stroke: c.tooltipBorder }}
                contentStyle={{
                  background: c.tooltipBg,
                  border: `1px solid ${c.tooltipBorder}`,
                  borderRadius: 12,
                  color: c.text,
                  fontSize: 12,
                  boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                }}
                formatter={(value: number, name: string) => [value, name]}
                labelFormatter={() => ''}
              />
              <Scatter data={scatter} isAnimationActive={false}>
                {scatter.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.responded ? POSITIVE : NEGATIVE}
                    fillOpacity={0.62}
                    stroke={d.responded ? POSITIVE : NEGATIVE}
                    strokeOpacity={0.9}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-4 pt-4 flex items-start gap-2 text-[12px] leading-relaxed text-soft" style={{ borderTop: '1px solid var(--hairline)' }}>
          <Info size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--text-faint)' }} />
          <span>
            This is an <strong>observed</strong> pre/post comparison, not a randomized causal
            estimate; some of the fall is regression to the mean and would occur without any
            intervention. Points above the diagonal are non-responders. It describes outcomes —
            it does not prove the interventions caused them.
          </span>
        </p>
      </div>

      {/* Recent outcomes table */}
      <div className="mt-5 card-flush reveal">
        <div className="flex flex-wrap items-center gap-2 px-6 py-5" style={{ borderBottom: '1px solid var(--hairline)' }}>
          <h2 className="section-title">Recent outcomes</h2>
          <span className="text-[13px] text-faint tabular-nums">{recent.length} shown</span>
          <div className="ml-auto segmented">
            {(['all', 1, 2, 3, 4, 5] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={`segmented-btn ${levelFilter === lvl ? 'segmented-btn-active' : ''}`}
              >
                {lvl === 'all' ? 'All' : `L${lvl}`}
              </button>
            ))}
          </div>
        </div>

        {recent.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <Activity size={32} className="mx-auto mb-3" style={{ color: 'var(--text-faint)' }} />
            <p className="text-sm text-soft">No interventions at this escalation level.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs" style={{ color: 'var(--text-faint)' }}>
                  <th className="px-6 py-3 font-semibold">Player</th>
                  <th className="px-3 py-3 font-semibold">Risk at action</th>
                  <th className="px-3 py-3 font-semibold">Level</th>
                  <th className="px-3 py-3 font-semibold">Pre → post</th>
                  <th className="px-3 py-3 font-semibold">Change</th>
                  <th className="px-3 py-3 font-semibold">Responded</th>
                  <th className="px-6 py-3 font-semibold text-right">When</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recent.slice(0, 40).map((o) => {
                  const preBand = bandForScore(o.preRisk)
                  const dropped = o.delta > 0
                  return (
                    <tr key={o.id} className="lift hover:bg-[var(--surface-2)] transition-colors">
                      <td className="px-6 py-3 font-semibold whitespace-nowrap">{o.handle}</td>
                      <td className="px-3 py-3">
                        <RiskBadge band={preBand} score={o.preRisk} size="sm" />
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="rounded-md px-2 py-0.5 text-xs font-bold tabular-nums"
                          style={{ background: 'var(--brand-tint)', color: 'var(--brand-strong)' }}
                        >
                          L{o.level}
                        </span>
                      </td>
                      <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                        <span style={{ color: preBand.color }} className="font-semibold">{o.preRisk}</span>
                        <span className="text-faint mx-1.5">→</span>
                        <span style={{ color: bandForScore(o.postRisk).color }} className="font-semibold">{o.postRisk}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="inline-flex items-center gap-0.5 text-[13px] font-semibold tabular-nums"
                          style={{ color: dropped ? POSITIVE : NEGATIVE }}
                        >
                          {dropped ? '−' : '+'}
                          {Math.abs(o.delta)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={
                            o.responded
                              ? { background: 'rgba(52,199,89,0.16)', color: '#4f8a5f' }
                              : { background: 'var(--surface-3)', color: 'var(--text-faint)' }
                          }
                        >
                          {o.responded ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-xs text-faint tabular-nums whitespace-nowrap">
                        {o.daysAgo}d ago
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
