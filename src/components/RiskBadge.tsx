import type { RiskBand } from '../types'

export function RiskBadge({
  band,
  score,
  size = 'md',
}: {
  band: RiskBand
  score?: number
  size?: 'sm' | 'md'
}) {
  const pad = size === 'sm' ? 'px-1.5 py-px text-[11px]' : 'px-2 py-0.5 text-[12px]'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[4px] font-medium whitespace-nowrap ${pad}`}
      style={{ background: band.tint, color: band.color }}
    >
      <span className="h-1.5 w-1.5 rounded-[1px]" style={{ background: band.color }} />
      {score !== undefined ? (
        <>
          <span className="font-mono font-medium tabular-nums">{score}</span>
          <span>{band.label}</span>
        </>
      ) : (
        band.label
      )}
    </span>
  )
}

export function ScorePill({ score, color }: { score: number; color: string }) {
  return (
    <span
      className="inline-flex h-7 min-w-[2rem] items-center justify-center rounded-[4px] px-2 text-sm font-mono font-medium tabular-nums"
      style={{ background: `${color}1f`, color }}
    >
      {score}
    </span>
  )
}
