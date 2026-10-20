import { useState } from 'react'
import { ChevronDown, ShieldCheck } from 'lucide-react'
import {
  GAME_DIMENSIONS,
  GAME_QUESTIONS,
  bandForGameScore,
  dimensionLabel,
} from '../../lib/gameRisk'
import type { CatalogGame } from '../../store/useGameStore'
import { QuestionControl } from './QuestionControl'
import { TierBadge } from './TierBadge'

/** Inline detail for an expanded catalog row: the full editable answer sheet
 *  on the left, the live-re-scored profile (drivers + mitigations) on the
 *  right. Every edit re-scores immediately via the store. */
export function GameEditor({
  game,
  onAnswer,
}: {
  game: CatalogGame
  onAnswer: (questionId: string, value: number | boolean) => void
}) {
  const { profile } = game
  // Accordion: only the (initially) riskiest dimension's questions are open —
  // the subscore bars always carry the answer; the answer sheet is on demand.
  const [openDim, setOpenDim] = useState<string | null>(
    () =>
      GAME_DIMENSIONS.reduce(
        (best, d) => (profile.dimensions[d.id] > profile.dimensions[best] ? d.id : best),
        GAME_DIMENSIONS[0].id,
      ),
  )
  return (
    <div className="grid grid-cols-1 gap-6 px-6 py-5 lg:grid-cols-3" style={{ background: 'var(--surface-2)' }}>
      {/* Answer sheet — dimension subscores always visible, questions accordion */}
      <div className="lg:col-span-2 space-y-1.5 self-start">
        {GAME_DIMENSIONS.map((dim) => {
          const sub = profile.dimensions[dim.id]
          const subColor = bandForGameScore(sub).color
          const open = openDim === dim.id
          const count = GAME_QUESTIONS.filter((q) => q.dimension === dim.id).length
          return (
            <div key={dim.id} className="min-w-0">
              <button
                type="button"
                onClick={() => setOpenDim(open ? null : dim.id)}
                aria-expanded={open}
                className="focus-ring w-full rounded-lg px-2 py-2 -mx-2 text-left transition-colors hover:bg-[var(--surface-3)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="eyebrow">
                    {dim.label} <span className="normal-case tracking-normal">· {count} items</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-[12px] font-bold tabular-nums" style={{ color: subColor }}>
                      {sub}
                    </span>
                    <ChevronDown
                      size={13}
                      className={`text-faint transition-transform ${open ? 'rotate-180' : ''}`}
                    />
                  </span>
                </div>
                <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                  <div className="h-full rounded-full" style={{ width: `${sub}%`, background: subColor }} />
                </div>
              </button>
              {open && (
                <div className="mt-0.5 mb-2 divide-y" style={{ borderColor: 'var(--hairline)' }}>
                  {GAME_QUESTIONS.filter((q) => q.dimension === dim.id).map((q) => (
                    <QuestionControl
                      key={q.id}
                      question={q}
                      value={game.answers[q.id]}
                      onChange={(v) => onAnswer(q.id, v)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Live profile */}
      <div className="card !p-5 self-start">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="eyebrow">Structural score</div>
            <div className="mt-1.5 stat-num" style={{ color: profile.band.color }}>
              {profile.overall}
              <span className="text-[15px] font-medium text-faint"> / 100</span>
            </div>
          </div>
          <TierBadge band={profile.band} />
        </div>
        <p className="mt-2 text-[12px] leading-snug text-soft">{profile.band.description}</p>

        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--hairline)' }}>
          <div className="eyebrow">Top drivers</div>
          {profile.drivers.length === 0 ? (
            <p className="mt-2 text-[12px] text-faint">No risk-bearing features flagged.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {profile.drivers.map((d) => (
                <li key={d.id} className="flex items-baseline justify-between gap-2 text-[12px]">
                  <span className="min-w-0">
                    <span className="font-medium">{d.prompt}</span>
                    <span className="text-faint"> · {dimensionLabel(d.dimension)}</span>
                  </span>
                  <span
                    className="shrink-0 font-bold tabular-nums"
                    style={{ color: bandForGameScore(d.risk).color }}
                  >
                    {d.risk}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--hairline)' }}>
          <div className="eyebrow">Recommended mitigations</div>
          <ul className="mt-2 space-y-1.5">
            {profile.mitigations.map((m) => (
              <li key={m.id} className="flex items-start gap-1.5 text-[12px] leading-snug">
                <ShieldCheck size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />
                <span>
                  {m.label}
                  <span className="text-faint"> · {dimensionLabel(m.dimension)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
