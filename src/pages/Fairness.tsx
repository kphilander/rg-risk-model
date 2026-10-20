import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CheckCircle2, AlertTriangle, Eye } from 'lucide-react'
import { KpiCard } from '../components/KpiCard'
import { Disclosure } from '../components/Disclosure'
import { SubgroupBar } from '../components/fairness/SubgroupBar'
import { useStore } from '../store/useStore'
import { useChartColors } from '../lib/useChartColors'
import { RISK_BANDS } from '../lib/riskBands'
import { buildHarmLabels } from '../data/outcomes'
import {
  type Dimension,
  buildRows,
  subgroupStats,
  flagRateDisparity,
  calibrationByBand,
  calibrationByGroup,
  isMonotonic,
  overallStats,
  observationChannelStats,
  observationRateDisparity,
  pct,
  FLAG_THRESHOLD,
} from '../lib/fairness'

const DIMENSIONS: { id: Dimension; label: string }[] = [
  { id: 'gender', label: 'Gender' },
  { id: 'ageBand', label: 'Age band' },
  { id: 'jurisdiction', label: 'Jurisdiction' },
]

// A small qualitative palette for the grouped calibration series (theme-neutral,
// distinct from the risk-band colours which are reserved for the band axis).
const SERIES_COLORS = ['var(--brand)', 'var(--teal)', '#b81d45']

export function Fairness() {
  const players = useStore((s) => s.players)
  const assessments = useStore((s) => s.assessments)
  const interactions = useStore((s) => s.interactions)
  const c = useChartColors()
  const [dim, setDim] = useState<Dimension>('gender')

  // Synthetic proxy ground-truth — stable across renders for a fixed roster.
  const harm = useMemo(() => buildHarmLabels(players), [players])
  const rows = useMemo(() => buildRows(players, assessments, harm), [players, assessments, harm])

  // Portfolio-wide calibration + headline figures (dimension-independent).
  const calibration = useMemo(() => calibrationByBand(rows), [rows])
  const overall = useMemo(() => overallStats(rows, calibration), [rows, calibration])
  const monotonic = useMemo(() => isMonotonic(calibration), [calibration])

  // Subgroup analytics for the selected grouping dimension.
  const groups = useMemo(() => subgroupStats(rows, dim), [rows, dim])
  const disparity = useMemo(() => flagRateDisparity(groups), [groups])
  const groupCalibration = useMemo(() => calibrationByGroup(rows, dim), [rows, dim])

  // Observation-channel fairness: bias in who staff choose to watch/uplift/floor.
  const observation = useMemo(
    () => observationChannelStats(players, assessments, interactions, dim),
    [players, assessments, interactions, dim],
  )
  const observationDisparity = useMemo(() => observationRateDisparity(observation), [observation])

  const maxFlagRate = Math.max(...groups.map((g) => g.flagRate), 0.0001)
  const groupsWithHarm = groups.filter((g) => g.harmed > 0)
  const maxRecall = Math.max(...groupsWithHarm.map((g) => g.recall), 0.0001)

  // Observation-channel bar normalisers + the mean-uplift disparity (points).
  const maxObservationRate = Math.max(...observation.map((g) => g.observationRate), 0.0001)
  const maxFloorRate = Math.max(...observation.map((g) => g.floorRate), 0.0001)
  const upliftValues = observation.map((g) => g.meanUplift)
  const maxUplift = upliftValues.length ? Math.max(...upliftValues) : 0
  const minUplift = upliftValues.length ? Math.min(...upliftValues) : 0
  const upliftGap = maxUplift - minUplift

  const calibrationData = calibration.map((p) => ({
    band: p.bandLabel,
    harm: Math.round(p.harmRate * 100),
    n: p.n,
    color: p.color,
  }))

  // Grouped calibration: one row per band, one numeric column per chosen group.
  const groupCalibrationData = groupCalibration.data.map((row) => {
    const entry: Record<string, number | string> = { band: row.bandLabel }
    for (const g of groupCalibration.groups) entry[g.key] = Math.round(row.rates[g.key] * 100)
    return entry
  })

  const emptyPortfolio = rows.length === 0

  return (
    <div>
      {/* Hero */}
      <div className="page-head">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2.5">
              <div>
                <h1 className="large-title">Fairness &amp; calibration</h1>
                <p className="text-[14px] text-soft mt-0.5">
                  Checks that the score treats subgroups consistently and that its bands track observed harm.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="chip">{rows.length.toLocaleString()} players</span>
              <span className="chip">Flag threshold · score &ge; {FLAG_THRESHOLD}</span>
              <span className="chip">Outcome · synthetic harm proxy</span>
            </div>
          </div>

          {/* Grouping dimension switch */}
          <div className="shrink-0">
            <div className="eyebrow mb-2 lg:text-right">Group by</div>
            <div className="segmented">
              {DIMENSIONS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDim(d.id)}
                  className={`segmented-btn ${dim === d.id ? 'segmented-btn-active' : ''}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Headline verdict */}
      <div className="mt-5">
        <div className="eyebrow mb-3">Headline verdict</div>
        <div className="kpi-strip">
          <KpiCard
            label={`Largest flag-rate gap · ${DIMENSIONS.find((d) => d.id === dim)!.label.toLowerCase()}`}
            value={`${(disparity.spread * 100).toFixed(1)} pp`}
            valueColor={disparity.spread > 0.15 ? '#c46a1c' : undefined}
            sub={
              disparity.maxGroup && disparity.minGroup && disparity.maxGroup.key !== disparity.minGroup.key
                ? `${disparity.maxGroup.label} ${pct(disparity.maxGroup.flagRate)} vs ${disparity.minGroup.label} ${pct(disparity.minGroup.flagRate)}`
                : 'single eligible subgroup'
            }
          />
          <KpiCard
            label="Calibration"
            value={monotonic ? 'Monotonic' : 'Non-monotonic'}
            valueColor={monotonic ? '#4f8a5f' : '#c46a1c'}
            sub={`Low band ${pct(overall.lowBandHarmRate)} → Critical ${pct(overall.criticalBandHarmRate)} harm`}
          />
          <KpiCard
            label="Overall recall"
            value={pct(overall.recall)}
            valueColor="#c46a1c"
            sub={`${overall.flagged.toLocaleString()} flagged · caught ${overall.harmed > 0 ? Math.round(overall.recall * overall.harmed) : 0}/${overall.harmed} harmed`}
          />
          <KpiCard
            label="Flag precision"
            value={pct(overall.precision)}
            sub={`${pct(overall.harmed / Math.max(overall.n, 1), 1)} portfolio harm base rate`}
          />
        </div>
      </div>

      {emptyPortfolio ? (
        <div className="card mt-5 reveal text-center text-[13px] text-faint py-10">
          No player data available to audit.
        </div>
      ) : (
        <>
          {/* Flag-rate parity */}
          <div className="mt-5 reveal">
          <Disclosure
            title="Flag-rate parity"
            summary={`${(disparity.spread * 100).toFixed(1)} pp spread across subgroups · harm base rates alongside`}
            flush
          >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 p-5">
            <div className="card lg:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="section-title">Flag-rate parity</h2>
                  <p className="section-sub">
                    Share of each subgroup the model flags High or Critical (score &ge; {FLAG_THRESHOLD})
                  </p>
                </div>
                <span
                  className="text-[11px] font-semibold tabular-nums rounded-full px-2.5 py-1"
                  style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}
                >
                  {(disparity.spread * 100).toFixed(1)} pp spread
                </span>
              </div>
              <div className="mt-4 space-y-1.5">
                {groups.map((g) => (
                  <SubgroupBar
                    key={g.key}
                    label={g.label}
                    n={g.n}
                    rate={g.flagRate}
                    denomLabel={`${g.flagged} of ${g.n} flagged`}
                    color="var(--brand)"
                    max={maxFlagRate}
                    smallN={g.smallN}
                    extreme={
                      disparity.maxGroup?.key === g.key
                        ? 'high'
                        : disparity.minGroup?.key === g.key && disparity.spread > 0
                          ? 'low'
                          : null
                    }
                  />
                ))}
              </div>
            </div>

            {/* Harm base rate by subgroup — context for whether flag gaps are warranted */}
            <div className="card">
              <h2 className="section-title">Harm base rate</h2>
              <p className="section-sub">Observed harm proxy per subgroup — differing flag rates can be legitimate if base rates differ</p>
              <div className="mt-4 space-y-1.5">
                {groups.map((g) => (
                  <SubgroupBar
                    key={g.key}
                    label={g.label}
                    n={g.n}
                    rate={g.harmRate}
                    denomLabel={`${g.harmed} of ${g.n} harmed`}
                    color="var(--teal)"
                    max={Math.max(...groups.map((x) => x.harmRate), 0.0001)}
                    smallN={g.smallN}
                  />
                ))}
              </div>
            </div>
          </div>
          </Disclosure>
          </div>

          {/* Calibration */}
          <div className="mt-5 reveal">
          <Disclosure
            title="Calibration"
            summary={`${monotonic ? 'monotonic' : 'non-monotonic'} · Low ${pct(overall.lowBandHarmRate)} → Critical ${pct(overall.criticalBandHarmRate)} harm`}
            flush
          >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 p-5">
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="section-title">Calibration curve</h2>
                  <p className="section-sub">Observed harm rate per predicted band — should rise monotonically</p>
                </div>
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-1"
                  style={{
                    background: monotonic ? 'rgba(52,199,89,0.14)' : 'rgba(255,149,0,0.16)',
                    color: monotonic ? '#4f8a5f' : '#c46a1c',
                  }}
                >
                  {monotonic ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                  {monotonic ? 'Monotonic' : 'Check bands'}
                </span>
              </div>
              <div className="mt-5 h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={calibrationData} margin={{ top: 8, right: 6, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke={c.grid} strokeWidth={1} vertical={false} />
                    <XAxis dataKey="band" tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tick={{ fill: c.axis, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                      unit="%"
                    />
                    <Tooltip
                      cursor={{ fill: c.grid }}
                      contentStyle={{
                        background: c.tooltipBg,
                        border: `1px solid ${c.tooltipBorder}`,
                        borderRadius: 12,
                        color: c.text,
                        fontSize: 12,
                        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                      }}
                      formatter={(value: number, _n, item) => [
                        `${value}% harm · n=${(item?.payload as { n: number })?.n ?? 0}`,
                        'Observed',
                      ]}
                    />
                    <Bar dataKey="harm" radius={[6, 6, 0, 0]} isAnimationActive={false} name="Observed harm">
                      {calibrationData.map((d) => (
                        <Cell key={d.band} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 pt-3" style={{ borderTop: '1px solid var(--hairline)' }}>
                {calibration.map((p) => (
                  <span key={p.bandId} className="inline-flex items-center gap-1.5 text-[11px] text-faint tabular-nums">
                    <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                    {p.bandLabel}: {pct(p.harmRate)} <span className="opacity-60">(n={p.n})</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Calibration across the selected dimension's largest subgroups */}
            <div className="card">
              <h2 className="section-title">Calibration by {DIMENSIONS.find((d) => d.id === dim)!.label.toLowerCase()}</h2>
              <p className="section-sub">
                Harm rate per band for the {groupCalibration.groups.length} largest subgroups — curves should track together
              </p>
              <div className="mt-5 h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={groupCalibrationData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke={c.grid} strokeWidth={1} vertical={false} />
                    <XAxis dataKey="band" tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tick={{ fill: c.axis, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                      unit="%"
                    />
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
                      formatter={(value: number) => [`${value}%`, 'Harm']}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11, color: c.axis }}
                      iconType="plainline"
                      formatter={(value) => groupCalibration.groups.find((g) => g.key === value)?.label ?? value}
                    />
                    {groupCalibration.groups.map((g, i) => (
                      <Line
                        key={g.key}
                        type="monotone"
                        dataKey={g.key}
                        name={g.key}
                        stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                        strokeWidth={2.25}
                        dot={{ r: 3, strokeWidth: 0 }}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                        isAnimationActive={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 text-[11px] text-faint pt-3" style={{ borderTop: '1px solid var(--hairline)' }}>
                Cells with few players are volatile; a band with zero members in a subgroup is skipped.
              </div>
            </div>
          </div>
          </Disclosure>
          </div>

          {/* Equal opportunity (recall) */}
          <div className="mt-5 reveal">
          <Disclosure
            title="Equal opportunity · recall"
            summary={`overall ${pct(overall.recall)} of harmed players flagged`}
            flush
          >
          <div className="p-5 pt-4">
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-1.5">
              {groups.map((g) => (
                <SubgroupBar
                  key={g.key}
                  label={g.label}
                  n={g.n}
                  rate={g.recall}
                  denomLabel={g.harmed > 0 ? `${g.harmedFlagged} of ${g.harmed} harmed flagged` : 'no harmed players'}
                  color="#c46a1c"
                  max={maxRecall}
                  smallN={g.smallN || g.harmed < 10}
                />
              ))}
            </div>
            <div className="mt-4 pt-4 flex items-center gap-2" style={{ borderTop: '1px solid var(--hairline)' }}>
              <ReferenceDot color="#c46a1c" />
              <span className="text-[11px] text-faint">
                Recall is undefined for subgroups with no harmed players; those bars read 0% and are marked small n.
              </span>
            </div>
          </div>
          </Disclosure>
          </div>

          {/* Observation channel — fairness of the discretionary staff-attention overlay */}
          <div className="mt-5 reveal">
          <Disclosure
            title="Observation channel"
            summary={`${(observationDisparity.spread * 100).toFixed(1)} pp observation-rate spread — staff attention is discretionary`}
            flush
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 p-5">
              {/* Observation rate — who gets watched at all */}
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="section-title">Observation rate</h2>
                    <p className="section-sub">Share of each subgroup with &ge; 1 interaction logged</p>
                  </div>
                  <span
                    className="text-[11px] font-semibold tabular-nums rounded-full px-2.5 py-1"
                    style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}
                  >
                    {(observationDisparity.spread * 100).toFixed(1)} pp spread
                  </span>
                </div>
                <div className="mt-4 space-y-1.5">
                  {observation.map((g) => (
                    <SubgroupBar
                      key={g.key}
                      label={g.label}
                      n={g.n}
                      rate={g.observationRate}
                      denomLabel={`${g.observed} of ${g.n} observed`}
                      color="var(--brand)"
                      max={maxObservationRate}
                      smallN={g.smallN}
                      extreme={
                        observationDisparity.maxGroup?.key === g.key
                          ? 'high'
                          : observationDisparity.minGroup?.key === g.key && observationDisparity.spread > 0
                            ? 'low'
                            : null
                      }
                    />
                  ))}
                </div>
              </div>

              {/* Mean observed uplift — how many points the overlay adds per subgroup */}
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="section-title">Mean observed uplift</h2>
                    <p className="section-sub">Average points the staff overlay adds across the subgroup</p>
                  </div>
                  <span
                    className="text-[11px] font-semibold tabular-nums rounded-full px-2.5 py-1"
                    style={{ background: 'color-mix(in srgb, var(--teal) 14%, transparent)', color: 'var(--teal)' }}
                  >
                    {upliftGap.toFixed(1)} pt gap
                  </span>
                </div>
                <div className="mt-4 space-y-1.5">
                  {observation.map((g) => {
                    const width = maxUplift > 0 ? Math.min(100, (g.meanUplift / maxUplift) * 100) : 0
                    return (
                      <div
                        key={g.key}
                        className="lift rounded-lg px-3 py-2.5"
                        style={{ background: 'var(--surface-2)' }}
                        title={`${g.label} · n=${g.n}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: 'var(--teal)' }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px] font-medium truncate">{g.label}</span>
                              {g.smallN && (
                                <span
                                  className="text-[9px] font-bold rounded px-1 py-px shrink-0"
                                  style={{ background: 'var(--surface-3)', color: 'var(--text-faint)' }}
                                  title="Small sample — interpret with caution"
                                >
                                  small n
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-faint mt-0.5 tabular-nums">
                              {g.observed} of {g.n} observed
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[15px] font-semibold tabular-nums" style={{ color: 'var(--teal)' }}>
                              +{g.meanUplift.toFixed(1)}
                            </div>
                            <div className="text-[10px] text-faint tabular-nums">pts</div>
                          </div>
                        </div>
                        <div
                          className="mt-2 ml-5 h-1.5 rounded-full overflow-hidden"
                          style={{ background: 'var(--surface-3)' }}
                        >
                          <div className="h-full rounded-full" style={{ width: `${width}%`, background: 'var(--teal)' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Disclosure-floor rate — open critical disclosures holding a floor */}
              <div className="card">
                <h2 className="section-title">Disclosure-floor rate</h2>
                <p className="section-sub">Share of each subgroup carrying an open disclosure floor</p>
                <div className="mt-4 space-y-1.5">
                  {observation.map((g) => (
                    <SubgroupBar
                      key={g.key}
                      label={g.label}
                      n={g.n}
                      rate={g.floorRate}
                      denomLabel={`${g.floored} of ${g.n} open`}
                      color="#c46a1c"
                      max={maxFloorRate}
                      smallN={g.smallN}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Plain-language caption — why the observation channel is a bias vector */}
            <div className="card mx-5 mb-5 !py-4">
              <div className="flex gap-2.5 items-start">
                <Eye size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--text-faint)' }} />
                <p className="text-[12.5px] leading-relaxed text-faint">
                  <span className="font-semibold" style={{ color: 'var(--text-soft)' }}>Why this matters.</span>{' '}
                  Staff choose whom to observe, so a closely watched subgroup accrues more uplift and more disclosure floors at equal underlying risk. A large gap can bias scores even when the data-only model is fair.
                </p>
              </div>
            </div>
          </Disclosure>
          </div>

          {/* Honest caveat */}
          <div className="card mt-5 reveal !py-4">
            <div className="flex gap-2.5 items-start">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--text-faint)' }} />
              <p className="text-[12.5px] leading-relaxed text-faint">
                <span className="font-semibold" style={{ color: 'var(--text-soft)' }}>Interpretation.</span>{' '}
                The harm outcome is a <em>synthetic proxy</em> generated for this demo, not observed
                clinical harm — figures illustrate the method, not the production model. Subgroup sizes
                vary widely (some clear the {`n≥30`} confidence bar, others do not), so small-n bars are
                noisy. This is <em>descriptive</em> fairness — flag-rate parity, calibration and equal
                opportunity — not a causal audit; differing flag rates can be legitimate where underlying
                harm base rates differ. Bands: {RISK_BANDS.map((b) => b.label).join(' · ')}.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** Tiny legend swatch used in the recall footnote. */
function ReferenceDot({ color }: { color: string }) {
  return <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
}
