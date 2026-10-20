import { Fragment, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChevronDown, Dices, RotateCcw } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { GameEditor } from '../components/gamerisk/GameEditor'
import { TierBadge } from '../components/gamerisk/TierBadge'
import { bandForGameScore, tierOf, type GameBandInfo } from '../lib/gameRisk'
import { RISK_BANDS } from '../lib/riskBands'
import { useChartColors } from '../lib/useChartColors'
import { useGameStore } from '../store/useGameStore'
import { useStore } from '../store/useStore'
import type { GameSpeed, RiskBandId } from '../types'

const SPEEDS: GameSpeed[] = ['fast', 'medium', 'slow']
const SPEED_LABEL: Record<GameSpeed, string> = { fast: 'Fast', medium: 'Medium', slow: 'Slow' }

/** Mean structural score of the catalog games in one speed class — the bridge
 *  between the game instrument and player activity (which only knows speed). */
interface SpeedStat {
  speed: GameSpeed
  games: number
  meanScore: number | null
  band: GameBandInfo | null
}

interface ExposureRow {
  id: RiskBandId
  label: string
  n: number
  fast: number
  medium: number
  slow: number
  /** Share of the band's play time on Tier 3+ speed classes — the headline. */
  risky: number
}

const round1 = (x: number): number => Math.round(x * 10) / 10

export function GameRisk() {
  const players = useStore((s) => s.players)
  const assessments = useStore((s) => s.assessments)
  const games = useGameStore((s) => s.games)
  const updateAnswers = useGameStore((s) => s.updateAnswers)
  const resetCatalog = useGameStore((s) => s.resetCatalog)
  const c = useChartColors()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Speed class → mean game tier (the join key into player activity).
  const speedStats = useMemo<SpeedStat[]>(
    () =>
      SPEEDS.map((speed) => {
        const list = games.filter((g) => g.speedClass === speed)
        if (list.length === 0) return { speed, games: 0, meanScore: null, band: null }
        const meanScore = list.reduce((s, g) => s + g.profile.overall, 0) / list.length
        return { speed, games: list.length, meanScore, band: bandForGameScore(meanScore) }
      }),
    [games],
  )

  // Speed classes whose catalog average lands Tier 3+ — "structurally risky play".
  const riskySpeeds = useMemo(
    () => new Set(speedStats.filter((s) => s.band && tierOf(s.band) >= 3).map((s) => s.speed)),
    [speedStats],
  )

  // Exposure cross-view from the REAL player data: for each player, the share
  // of active minutes on fast/medium/slow play, averaged within their current
  // risk band; plus portfolio-level minutes for the KPI.
  const exposure = useMemo(() => {
    const agg = new Map<RiskBandId, { fast: number; medium: number; slow: number; n: number }>()
    const minutesBySpeed: Record<GameSpeed, number> = { fast: 0, medium: 0, slow: 0 }
    let totalMinutes = 0

    for (const p of players) {
      const a = assessments.get(p.id)
      if (!a) continue
      const mins: Record<GameSpeed, number> = { fast: 0, medium: 0, slow: 0 }
      let tot = 0
      for (const d of p.activity) {
        if (!d.played || d.minutes <= 0) continue
        mins[d.gameSpeed] += d.minutes
        tot += d.minutes
      }
      for (const s of SPEEDS) minutesBySpeed[s] += mins[s]
      totalMinutes += tot
      if (tot === 0) continue
      const rec = agg.get(a.band.id) ?? { fast: 0, medium: 0, slow: 0, n: 0 }
      for (const s of SPEEDS) rec[s] += mins[s] / tot
      rec.n += 1
      agg.set(a.band.id, rec)
    }

    const rows: ExposureRow[] = RISK_BANDS.map((b) => {
      const rec = agg.get(b.id)
      const share = (k: GameSpeed) => (rec && rec.n > 0 ? round1((rec[k] / rec.n) * 100) : 0)
      const bySpeed = { fast: share('fast'), medium: share('medium'), slow: share('slow') }
      return {
        id: b.id,
        label: b.label,
        n: rec?.n ?? 0,
        ...bySpeed,
        risky: round1(SPEEDS.filter((s) => riskySpeeds.has(s)).reduce((sum, s) => sum + bySpeed[s], 0)),
      }
    })

    const riskyMinutes = SPEEDS.filter((s) => riskySpeeds.has(s)).reduce(
      (s, sp) => s + minutesBySpeed[sp],
      0,
    )
    return {
      rows,
      playersCounted: rows.reduce((s, r) => s + r.n, 0),
      riskyShare: totalMinutes > 0 ? Math.round((riskyMinutes / totalMinutes) * 100) : 0,
    }
  }, [players, assessments, riskySpeeds])

  const tier3Games = games.filter((g) => tierOf(g.profile.band) >= 3).length

  // Which speed classes count as Tier 3+ today (live — follows catalog edits).
  const riskyLabel =
    SPEEDS.filter((s) => riskySpeeds.has(s))
      .map((s) => SPEED_LABEL[s].toLowerCase())
      .join(' and ') || 'none'
  const yMax = Math.min(100, Math.ceil(Math.max(...exposure.rows.map((r) => r.risky), 10) / 10) * 10)

  return (
    <div>
      <PageHeader
        title="Game risk"
        subtitle="Structural risk ratings for each game, and how play time is distributed across them."
      />

      {/* Catalog */}
      <div className="card-flush reveal">
        <div
          className="flex flex-wrap items-center gap-2 px-6 py-5"
          style={{ borderBottom: '1px solid var(--hairline)' }}
        >
          <Dices size={17} style={{ color: 'var(--brand)' }} />
          <h2 className="section-title">Structural catalog</h2>
          <span className="text-[13px] text-faint tabular-nums">
            {games.length} games{tier3Games > 0 && <> · {tier3Games} at Tier 3+</>}
          </span>
          <button type="button" onClick={resetCatalog} className="btn btn-ghost ml-auto !px-3 !py-1.5 !text-[12px]">
            <RotateCcw size={13} /> Reset seeds
          </button>
        </div>

        {games.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-faint">
            Catalog is empty — reset to restore the six seeded archetypes.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs" style={{ color: 'var(--text-faint)' }}>
                  <th className="px-6 py-3 font-semibold">Game</th>
                  <th className="px-3 py-3 font-semibold text-right">Structural risk</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {games.map((g) => {
                  const open = expandedId === g.id
                  return (
                    <Fragment key={g.id}>
                      <tr
                        onClick={() => setExpandedId(open ? null : g.id)}
                        className="cursor-pointer transition-colors hover:bg-[var(--surface-2)]"
                        aria-expanded={open}
                      >
                        <td className="px-6 py-3.5">
                          <div className="font-semibold tracking-[-0.01em]">{g.name}</div>
                          <div className="mt-0.5 text-[12px] text-faint">
                            {g.category} · {SPEED_LABEL[g.speedClass]}
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-right">
                          <TierBadge band={g.profile.band} score={g.profile.overall} />
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <ChevronDown
                            size={15}
                            className={`inline-block text-faint transition-transform ${open ? 'rotate-180' : ''}`}
                          />
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={3} className="p-0">
                            <GameEditor
                              game={g}
                              onAnswer={(qid, v) => updateAnswers(g.id, { [qid]: v })}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Exposure cross-view */}
      <div className="card mt-5 reveal">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="section-title">Exposure by risk band</h2>
            <p className="section-sub">
              Share of each band&apos;s play time on Tier 3+ speed classes — currently{' '}
              {riskyLabel} play.
            </p>
          </div>
          <div className="text-right">
            <div className="eyebrow">Play time on Tier 3+ classes</div>
            <div className="stat-num mt-1" style={exposure.riskyShare >= 40 ? { color: '#c46a1c' } : undefined}>
              {exposure.riskyShare}%
            </div>
          </div>
        </div>

        {exposure.playersCounted === 0 ? (
          <div className="mt-5 py-12 text-center text-[13px] text-faint">
            No player activity to cross against the catalog yet.
          </div>
        ) : (
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={exposure.rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="24%">
                <CartesianGrid stroke={c.grid} strokeWidth={1} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: c.axis, fontSize: 12, fontWeight: 600 }}
                  tickLine={false}
                  axisLine={false}
                  dy={6}
                />
                <YAxis
                  domain={[0, yMax]}
                  tick={{ fill: c.axis, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={38}
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
                  formatter={(value: number) => [`${value}% of play time on Tier 3+ classes`]}
                  labelFormatter={(label: string) => {
                    const row = exposure.rows.find((r) => r.label === label)
                    return row
                      ? `${label} band · ${row.n} players — fast ${row.fast}% · medium ${row.medium}% · slow ${row.slow}%`
                      : label
                  }}
                />
                <Bar dataKey="risky" radius={[5, 5, 0, 0]} maxBarSize={34} isAnimationActive={false}>
                  {exposure.rows.map((r) => (
                    <Cell key={r.id} fill={RISK_BANDS.find((b) => b.id === r.id)?.color ?? '#5b6472'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <p className="mt-3 text-[12px] text-faint">
          Hover a bar for the speed-class split. High exposure alone doesn't show the games caused the risk.
        </p>
      </div>
    </div>
  )
}
