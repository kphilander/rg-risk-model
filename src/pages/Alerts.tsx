import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, ChevronRight } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { RiskBadge } from '../components/RiskBadge'
import { InterventionModal } from '../components/InterventionModal'
import { Pager } from '../components/Pager'
import { useStore } from '../store/useStore'
import { ESCALATION } from '../lib/riskBands'
import { relativeTime } from '../lib/format'
import type { PlayerProfile, RiskAssessment } from '../types'

const PAGE_SIZE = 25

export function Alerts() {
  const players = useStore((s) => s.players)
  const assessments = useStore((s) => s.assessments)
  const interventions = useStore((s) => s.interventions)
  const [minLevel, setMinLevel] = useState(3)
  const [target, setTarget] = useState<{ player: PlayerProfile; assessment: RiskAssessment } | null>(null)
  const [page, setPage] = useState(0)
  useEffect(() => setPage(0), [minLevel])

  // Players whose risk warrants action, with the most recent intervention (if any).
  const queue = useMemo(() => {
    const lastActioned = new Map<string, string>()
    for (const i of interventions) {
      if (!lastActioned.has(i.playerId)) lastActioned.set(i.playerId, i.timestamp)
    }
    return players
      .map((p) => ({ p, a: assessments.get(p.id)!, actionedAt: lastActioned.get(p.id) }))
      .filter(({ a }) => a.recommendedLevel >= minLevel)
      .sort((x, y) => y.a.score - x.a.score)
  }, [players, assessments, interventions, minLevel])

  // Cumulative counts — "Level 4+" includes level 5 — to match the >= filter.
  const counts = useMemo(() => {
    const atLeast: Record<number, number> = { 3: 0, 4: 0, 5: 0 }
    for (const p of players) {
      const lvl = assessments.get(p.id)!.recommendedLevel
      for (const k of [3, 4, 5]) if (lvl >= k) atLeast[k] += 1
    }
    return atLeast
  }, [players, assessments])
  const pageRows = queue.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div>
      <PageHeader
        title="Alert queue"
        subtitle="Players whose behavioral risk warrants operator action, ranked by severity"
      />

      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-4">
        {[5, 4, 3].map((lvl) => {
          const band = lvl === 5 ? 'critical' : lvl === 4 ? 'high' : 'elevated'
          const esc = ESCALATION[band as keyof typeof ESCALATION]
          return (
            <button
              key={lvl}
              onClick={() => setMinLevel(lvl)}
              aria-pressed={minLevel === lvl}
              className="card lift text-left transition focus-ring !p-4 sm:!p-6"
              style={minLevel === lvl ? { outline: `2px solid var(--brand)` } : undefined}
            >
              <div className="eyebrow">Level {lvl}+</div>
              <div className="stat-num mt-2">{counts[lvl] ?? 0}</div>
              <div className="text-xs text-faint mt-1">{lvl === 5 ? esc.action : `${esc.action} and above`}</div>
            </button>
          )
        })}
      </div>

      <div className="card-flush">
        <div className="flex items-center gap-2 px-6 py-5 border-b">
          <Bell size={16} style={{ color: 'var(--brand)' }} />
          <h2 className="section-title">{queue.length} players need review</h2>
          <span className="text-xs text-faint ml-auto hidden sm:inline">Level {minLevel} and above · ranked by score</span>
        </div>
        <div className="divide-y">
          {pageRows.map(({ p, a, actionedAt }) => {
            const esc = ESCALATION[a.band.id]
            return (
              <div
                key={p.id}
                className="flex flex-wrap md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_7.5rem_7.5rem_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 hover:bg-[var(--surface-2)] transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-[180px]">
                  <span className="h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ background: a.band.tint, color: a.band.color }}>
                    L{esc.level}
                  </span>
                  <div className="min-w-0">
                    <Link to={`/players/${p.id}`} className="font-semibold hover:underline">
                      {p.handle}
                    </Link>
                    <div className="text-xs text-faint truncate">
                      {a.topMarkers[0].label} · {a.topMarkers[1].label}
                    </div>
                  </div>
                </div>

                <div className="hidden md:block min-w-0">
                  <div className="text-sm font-medium">{esc.action}</div>
                  <div className="text-xs text-faint truncate">{esc.detail}</div>
                </div>

                <div className="md:justify-self-start">
                  <RiskBadge band={a.band} score={a.score} />
                </div>

                {actionedAt ? (
                  <span className="text-xs text-faint hidden sm:block">Actioned {relativeTime(actionedAt)}</span>
                ) : (
                  <span className="text-xs font-semibold hidden sm:block" style={{ color: '#c46a1c' }}>
                    Awaiting action
                  </span>
                )}

                <button onClick={() => setTarget({ player: p, assessment: a })} className="btn btn-primary !py-1.5 md:justify-self-end">
                  Action <ChevronRight size={14} />
                </button>
              </div>
            )
          })}
          {queue.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-faint">No players at this severity level.</div>
          )}
        </div>
        <Pager page={page} pageSize={PAGE_SIZE} total={queue.length} onPage={setPage} noun="players" />
      </div>

      {target && (
        <InterventionModal
          player={target.player}
          assessment={target.assessment}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  )
}
