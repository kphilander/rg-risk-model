import { GAME_DIMENSIONS, bandForGameScore, type GameDimension } from '../../lib/gameRisk'

/** Compact per-dimension subscore bars for a catalog row. Each bar is tinted
 *  by the game band its subscore falls in, so hot dimensions read at a glance. */
export function DimensionBars({
  dimensions,
  width = 72,
}: {
  dimensions: Record<GameDimension, number>
  width?: number
}) {
  return (
    <div className="space-y-1">
      {GAME_DIMENSIONS.map((d) => {
        const score = dimensions[d.id]
        const color = bandForGameScore(score).color
        return (
          <div
            key={d.id}
            className="flex items-center gap-2"
            title={`${d.label}: ${score}/100`}
          >
            <span className="w-11 text-[10px] font-semibold text-faint">
              {d.short}
            </span>
            <span
              className="h-1 rounded-full overflow-hidden shrink-0"
              style={{ width, background: 'var(--surface-3)' }}
            >
              <span
                className="block h-full rounded-full"
                style={{ width: `${score}%`, background: color }}
              />
            </span>
            <span className="w-6 text-right text-[10px] font-semibold tabular-nums text-soft">
              {score}
            </span>
          </div>
        )
      })}
    </div>
  )
}
