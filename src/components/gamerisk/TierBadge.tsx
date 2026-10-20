import type { GameBandInfo } from '../../lib/gameRisk'

/** Game-tier marker — a colored dot + tinted text (calm-UI: status is a dot,
 *  never a capsule). The game-catalog counterpart of the player RiskBadge. */
export function TierBadge({
  band,
  score,
  size = 'md',
}: {
  band: GameBandInfo
  score?: number
  size?: 'sm' | 'md'
}) {
  const text = size === 'sm' ? 'text-[12px]' : 'text-[13px]'
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold tabular-nums whitespace-nowrap ${text}`}
      style={{ color: band.color }}
      title={`${band.name} — ${band.description}`}
    >
      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: band.color }} />
      {score !== undefined ? `${score} · ${band.label}` : band.label}
    </span>
  )
}
