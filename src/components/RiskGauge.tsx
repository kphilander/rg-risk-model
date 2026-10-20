import type { RiskBand } from '../types'
import { RISK_BANDS } from '../lib/riskBands'

/** Linear 0–100 score readout: the figure, its band, and a scale of the five
 *  band ranges with a marker at the score. */
export function RiskGauge({
  score,
  band,
  size = 200,
}: {
  score: number
  band: RiskBand
  size?: number
}) {
  const pos = Math.max(0, Math.min(100, score))
  return (
    <div style={{ width: size }} aria-label={`Risk score ${score} of 100, ${band.label}`}>
      <div className="eyebrow">Risk score</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="hero-num" style={{ color: 'var(--text)' }}>
          {score}
        </span>
        <span className="text-[13px] text-faint font-mono">/ 100</span>
      </div>
      <div className="mt-1 text-[13px] font-semibold" style={{ color: band.color }}>
        {band.label}
      </div>

      {/* Band scale */}
      <div className="relative mt-3 pt-2">
        <div className="flex h-1.5 gap-px overflow-hidden rounded-[2px]">
          {RISK_BANDS.map((b) => (
            <div
              key={b.id}
              style={{
                width: `${b.max - b.min + (b.max === 100 ? 0 : 1)}%`,
                background: b.id === band.id ? b.color : `color-mix(in srgb, ${b.color} 28%, var(--surface-3))`,
              }}
            />
          ))}
        </div>
        <div
          className="absolute top-0 h-[14px] w-[2px] -translate-x-1/2 rounded-[1px]"
          style={{ left: `${pos}%`, background: 'var(--text)' }}
          aria-hidden
        />
        <div className="mt-1 flex justify-between text-[10.5px] font-mono text-faint">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>
    </div>
  )
}
