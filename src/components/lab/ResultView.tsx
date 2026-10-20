import { CheckCircle2, MinusCircle } from 'lucide-react'
import type { ExperimentResult } from '../../lab/experiment'
import { KpiCard } from '../KpiCard'
import { ArmCard } from './ArmCard'
import { ArmDistributionChart } from './ArmDistributionChart'
import { metricMeta } from './metricMeta'

const SUCCESS = '#3f8a55'

/** The full read-out for a single experiment run: plain-language headline +
 *  significance chip, uplift KPIs, per-arm cards, and the distribution chart. */
export function ResultView({ result }: { result: ExperimentResult }) {
  const m = metricMeta(result.metric)
  const best = result.arms.find((a) => a.policy.id === result.bestId)
  const control = result.arms.find((a) => a.policy.id === result.baselineId)
  const upliftAbs = m.format(Math.abs(result.uplift))

  return (
    <div>
      {/* Headline + significance */}
      <div className="card reveal">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <span className="eyebrow">Result</span>
            <p className="mt-2 text-[17px] font-medium leading-snug tracking-[-0.01em]">
              {result.readout}
            </p>
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold"
            style={
              result.significant
                ? { background: `${SUCCESS}1f`, color: SUCCESS }
                : { background: 'var(--surface-3)', color: 'var(--text-faint)' }
            }
          >
            {result.significant ? (
              <CheckCircle2 size={15} strokeWidth={2.5} />
            ) : (
              <MinusCircle size={15} strokeWidth={2.5} />
            )}
            {result.significant ? 'Significant at 95%' : 'Not significant at 95%'}
          </span>
        </div>

        <div className="mt-5 kpi-strip">
          <KpiCard
            label="Uplift vs control"
            value={result.bestId === result.baselineId ? '—' : upliftAbs}
            valueColor={result.significant ? SUCCESS : undefined}
            sub={result.bestId === result.baselineId ? 'No arm beat control' : `Best arm − control`}
          />
          <KpiCard
            label="Best arm"
            value={best ? m.format(best.mean) : '—'}
            valueColor={SUCCESS}
            sub={best?.policy.label ?? '—'}
          />
          <KpiCard
            label="Control"
            value={control ? m.format(control.mean) : '—'}
            sub={control?.policy.label ?? '—'}
          />
          <KpiCard
            label="Cohort size"
            value={(best?.n ?? 0).toLocaleString()}
            sub={`Eligible players · ${result.arms.length} arms`}
          />
        </div>
      </div>

      {/* Arm cards */}
      <div className="mt-5 reveal">
        <h3 className="section-title mb-1">Per-arm effect</h3>
        <p className="section-sub mb-4">
          {m.blurb} {m.betterIsLower ? 'Lower is better.' : 'Higher is better.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {result.arms.map((arm) => (
            <ArmCard key={arm.policy.id} arm={arm} result={result} />
          ))}
        </div>
      </div>

      {/* Distribution */}
      <div className="mt-5 card reveal">
        <h3 className="section-title">Outcome distribution by arm</h3>
        <p className="section-sub">How each policy's per-player outcomes are spread</p>
        <div className="mt-4">
          <ArmDistributionChart result={result} />
        </div>
      </div>
    </div>
  )
}
