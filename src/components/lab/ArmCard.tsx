import { Check } from 'lucide-react'
import type { ArmResult, ExperimentResult } from '../../lab/experiment'
import { metricMeta } from './metricMeta'

const SUCCESS = '#3f8a55'

/** One competing policy's result. The best arm gets a green success ring; the
 *  no-action arm is tagged "control". Direction of "good" follows the metric. */
export function ArmCard({ arm, result }: { arm: ArmResult; result: ExperimentResult }) {
  const m = metricMeta(result.metric)
  const isBest = arm.policy.id === result.bestId
  const isControl = arm.policy.id === result.baselineId
  const [lo, hi] = arm.ci

  return (
    <div
      className="lift rounded-lg p-5"
      style={{
        background: 'var(--surface-2)',
        border: isBest ? `1.5px solid ${SUCCESS}` : '1px solid var(--border)',
        boxShadow: isBest ? `0 0 0 4px ${SUCCESS}1f` : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold leading-tight tracking-[-0.01em]">
            {arm.policy.label}
          </div>
          <div className="mt-1 text-[12px] text-faint tabular-nums">
            n={arm.n.toLocaleString()} · {arm.treated.toLocaleString()} treated
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {isBest && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: `${SUCCESS}26`, color: SUCCESS }}
            >
              <Check size={11} strokeWidth={3} />
              Best
            </span>
          )}
          {isControl && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: 'var(--surface-3)', color: 'var(--text-faint)' }}
            >
              Control
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span
          className="text-[28px] font-bold leading-none tabular-nums"
          style={{ letterSpacing: '-0.03em', color: isBest ? SUCCESS : 'var(--text)' }}
        >
          {m.format(arm.mean)}
        </span>
      </div>
      <div className="mt-2 text-[12px] text-soft tabular-nums">
        95% CI {m.format(lo)} – {m.format(hi)}
      </div>
    </div>
  )
}
