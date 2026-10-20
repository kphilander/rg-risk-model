import { useMemo, useState } from 'react'
import { FlaskConical, Info, Play, TrendingUp, ListChecks } from 'lucide-react'
import { useStore } from '../store/useStore'
import {
  buildRows,
  runExperiment,
  type ExperimentSpec,
  type MetricId,
} from '../lab/experiment'
import {
  allExperiments,
  buildCustomExperiment,
  type CustomParams,
} from '../lab/experiments'
import { MetricChip } from '../components/lab/MetricChip'
import { ResultView } from '../components/lab/ResultView'
import { metricMeta } from '../components/lab/metricMeta'

const MIN_SCORES = [20, 40, 60] as const
const LEVELS = [1, 2, 3, 4, 5] as const
const METRIC_ORDER: MetricId[] = ['risk_change', 'harm_averted', 'crossed_below_high']

export function Lab() {
  const players = useStore((s) => s.players)
  const assessments = useStore((s) => s.assessments)

  const examples = useMemo(() => allExperiments(), [])
  const [selectedId, setSelectedId] = useState<string>(examples[0]?.id ?? '')

  // Build-your-own parameters.
  const [minScore, setMinScore] = useState<number>(60)
  const [risingOnly, setRisingOnly] = useState<boolean>(false)
  const [treatmentLevel, setTreatmentLevel] = useState<number>(3)
  const [metric, setMetric] = useState<MetricId>('risk_change')

  const selectedSpec = useMemo<ExperimentSpec | undefined>(
    () => examples.find((e) => e.id === selectedId),
    [examples, selectedId],
  )

  // Memoized run of the selected example — keyed on spec id + portfolio.
  const selectedResult = useMemo(
    () =>
      selectedSpec ? runExperiment(selectedSpec, players, assessments) : undefined,
    [selectedSpec, players, assessments],
  )

  // Live custom experiment from the builder controls.
  const customParams: CustomParams = { minScore, risingOnly, treatmentLevel, metric }
  const customSpec = useMemo(
    () => buildCustomExperiment(customParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minScore, risingOnly, treatmentLevel, metric],
  )
  const customResult = useMemo(
    () => runExperiment(customSpec, players, assessments),
    [customSpec, players, assessments],
  )

  // Cohort size for the custom builder (before running any arm).
  const customCohortSize = useMemo(
    () => buildRows(players, assessments).filter(customSpec.cohort).length,
    [players, assessments, customSpec],
  )

  return (
    <div>
      {/* Hero header */}
      <div className="page-head mb-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 chip mb-3">
              <FlaskConical size={13} style={{ color: 'var(--brand)' }} />
              Experiment Lab
            </span>
            <h1 className="large-title">
              Intervention experiments
            </h1>
            <p className="mt-2.5 text-[15px] text-soft">
              Pick a question or design your own — a cohort, a set of competing intervention
              policies, and an outcome metric. Each experiment runs against a synthetic causal model
              (responders vs. non-responders plus natural drift) that is reproducible and seeded, so
              the same experiment always returns the same estimate.
            </p>
          </div>
          <div className="shrink-0 lg:text-right">
            <span className="eyebrow">Portfolio</span>
            <div className="mt-1.5 stat-num">{players.length.toLocaleString()}</div>
            <div className="text-[13px] text-faint mt-1">players available</div>
          </div>
        </div>
      </div>

      {/* Example experiments */}
      <div className="reveal">
        <div className="flex items-center gap-2 mb-4">
          <ListChecks size={16} style={{ color: 'var(--brand)' }} />
          <h2 className="section-title">Example experiments</h2>
          <span className="text-[13px] text-faint">Select one to run it below</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {examples.map((exp) => {
            const active = exp.id === selectedId
            return (
              <button
                key={exp.id}
                onClick={() => setSelectedId(exp.id)}
                className="card lift text-left flex flex-col h-full"
                style={{
                  border: active ? '1.5px solid var(--brand)' : '1px solid var(--border)',
                  boxShadow: active ? '0 0 0 4px var(--brand-tint)' : undefined,
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[16px] font-semibold leading-tight tracking-[-0.01em]">
                    {exp.name}
                  </h3>
                </div>
                <p className="mt-2 text-[13px] text-soft leading-relaxed flex-1">
                  {exp.question}
                </p>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <MetricChip metric={exp.metric} />
                  <span
                    className={`btn ${active ? 'btn-primary' : 'btn-ghost'} !px-3.5 !py-1.5 !text-[13px]`}
                  >
                    <Play size={13} strokeWidth={2.5} />
                    {active ? 'Showing' : 'Run'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected example result */}
      {selectedResult && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4 reveal">
            <TrendingUp size={16} style={{ color: 'var(--brand)' }} />
            <h2 className="section-title">{selectedSpec?.name}</h2>
          </div>
          <ResultView result={selectedResult} />
        </div>
      )}

      {/* Build your own */}
      <div className="mt-8 reveal">
        <div className="flex items-center gap-2 mb-4">
          <FlaskConical size={16} style={{ color: 'var(--brand)' }} />
          <h2 className="section-title">Build your own</h2>
          <span className="text-[13px] text-faint">Adjust the design — results update live</span>
        </div>

        <div className="card">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
            {/* Cohort: min score */}
            <div>
              <label className="eyebrow">Cohort · minimum risk score</label>
              <div className="segmented mt-2.5 w-full">
                {MIN_SCORES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setMinScore(s)}
                    className={`segmented-btn flex-1 ${minScore === s ? 'segmented-btn-active' : ''}`}
                  >
                    ≥ {s}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-faint">
                Only players scoring at or above this threshold are eligible.
              </p>
            </div>

            {/* Cohort: rising only */}
            <div>
              <label className="eyebrow">Cohort · trajectory filter</label>
              <div className="mt-2.5">
                <button
                  onClick={() => setRisingOnly((v) => !v)}
                  className="chip"
                  style={
                    risingOnly
                      ? { background: 'var(--brand-tint)', borderColor: 'var(--brand)', color: 'var(--brand)' }
                      : undefined
                  }
                >
                  <TrendingUp size={13} strokeWidth={2.5} />
                  Rising players only
                  <span className="ml-1 font-semibold">{risingOnly ? 'ON' : 'OFF'}</span>
                </button>
              </div>
              <p className="mt-2 text-[12px] text-faint">
                Restrict to players whose risk is accelerating (velocity ≥ 1 pt/week).
              </p>
            </div>

            {/* Policy: treatment level */}
            <div>
              <label className="eyebrow">Intervention policy · escalation level</label>
              <div className="segmented mt-2.5 w-full">
                {LEVELS.map((l) => (
                  <button
                    key={l}
                    onClick={() => setTreatmentLevel(l)}
                    className={`segmented-btn flex-1 ${treatmentLevel === l ? 'segmented-btn-active' : ''}`}
                  >
                    L{l}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-faint">
                The treatment arm intervenes at this level; compared against a no-action control.
              </p>
            </div>

            {/* Metric */}
            <div>
              <label className="eyebrow">Outcome metric</label>
              <div className="segmented mt-2.5 w-full">
                {METRIC_ORDER.map((mid) => (
                  <button
                    key={mid}
                    onClick={() => setMetric(mid)}
                    className={`segmented-btn flex-1 ${metric === mid ? 'segmented-btn-active' : ''}`}
                  >
                    {metricMeta(mid).short}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-faint">{metricMeta(metric).blurb}</p>
            </div>
          </div>

          {/* Design summary */}
          <div
            className="mt-6 pt-5 flex flex-wrap items-center gap-x-6 gap-y-2"
            style={{ borderTop: '1px solid var(--hairline)' }}
          >
            <div>
              <div className="text-[11px] text-faint font-semibold">
                Cohort size
              </div>
              <div className="stat-num mt-1 !text-[24px]">
                {customCohortSize.toLocaleString()}
              </div>
            </div>
            <p className="text-[13px] text-soft flex-1 min-w-[240px]">{customSpec.question}</p>
          </div>
        </div>

        {/* Live custom result */}
        <div className="mt-5">
          {customCohortSize === 0 ? (
            <div className="card reveal text-center py-14">
              <FlaskConical size={30} className="mx-auto mb-3" style={{ color: 'var(--text-faint)' }} />
              <p className="text-sm text-soft">
                No players match this cohort. Lower the minimum score or turn off the rising filter.
              </p>
            </div>
          ) : (
            <ResultView result={customResult} />
          )}
        </div>
      </div>

      {/* Honest caveat */}
      <div className="mt-8 card reveal" style={{ background: 'var(--surface-2)' }}>
        <div className="flex items-start gap-3">
          <div
            className="shrink-0 grid place-items-center h-9 w-9 rounded-lg"
            style={{ background: 'var(--surface-3)' }}
          >
            <Info size={17} style={{ color: 'var(--text-faint)' }} />
          </div>
          <div>
            <h3 className="section-title">A synthetic causal model — not a real-world estimate</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-soft max-w-3xl">
              Outcomes are generated by a seeded effect model: each treated player either responds
              (a level-dependent probability drives a risk drop) or does not, layered on top of the
              player's natural drift from their forecast. It is fully reproducible and useful for
              reasoning about experiment <em>design</em> — cohorts, arms, power, and direction — but
              the numbers are illustrative. They are <strong>not</strong> a causal estimate of what a
              real intervention would do, and confidence intervals reflect only sampling noise within
              the simulation.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
