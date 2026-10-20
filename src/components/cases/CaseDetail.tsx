import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, MessageSquareText, ShieldCheck, X, FileText } from 'lucide-react'
import type { Case, CasePriority, CaseStatus } from '../../store/useCaseStore'
import {
  ANALYSTS,
  PRIORITY_LABEL,
  STATUS_LABEL,
  UNASSIGNED,
  useCaseStore,
} from '../../store/useCaseStore'
import type {
  InterventionLevel,
  PlayerProfile,
  RiskAssessment,
  RiskBandId,
} from '../../types'
import { useStore } from '../../store/useStore'
import { ESCALATION, RISK_BANDS } from '../../lib/riskBands'
import { RiskBadge } from '../RiskBadge'
import { relativeTime } from '../../lib/format'
import { NoteTimeline } from './NoteTimeline'

const PRIORITIES: CasePriority[] = ['low', 'medium', 'high', 'urgent']
const STATUSES: CaseStatus[] = ['open', 'in_progress', 'awaiting', 'resolved']

// The 5 escalation templates, indexed by level, derived from the shared
// ESCALATION table so intervention actions stay in lockstep with the rest of
// the app.
const BAND_BY_LEVEL: Record<InterventionLevel, RiskBandId> = {
  1: 'low',
  2: 'moderate',
  3: 'elevated',
  4: 'high',
  5: 'critical',
}

// Templated player-facing comms per escalation level. The analyst edits these
// before applying — this is the "templated player-comms" layer on top of the
// app's bare log-intervention action.
function commsTemplate(level: InterventionLevel, handle: string): string {
  switch (level) {
    case 1:
      return `Hi ${handle}, just a friendly note that our safer-gambling tools — deposit limits, reality checks and session reminders — are available any time in your account settings.`
    case 2:
      return `Hi ${handle}, we noticed your play has picked up recently. It might be a good moment to set a deposit limit or a reality-check reminder. We're here if you'd like a hand setting those up.`
    case 3:
      return `Hi ${handle}, this is the player-protection team. We wanted to check in personally about your recent activity and make sure you're playing in a way that feels comfortable. Reply any time — we're happy to talk options.`
    case 4:
      return `Hi ${handle}, to help keep your play in a healthy range we're recommending a deposit limit and a short cool-off. We can apply these together — please reply and we'll walk you through the options.`
    case 5:
      return `Hi ${handle}, we're reaching out because we're concerned about your recent activity. We'd strongly encourage speaking with free, confidential support, and we can help arrange a break from play. Please reply — we're here to help.`
  }
}

// Applying an intervention pushes the case forward: fresh/in-progress cases move
// to "awaiting player" (outreach sent). Resolved cases are left as-is.
function advancedStatus(current: CaseStatus): CaseStatus {
  if (current === 'open' || current === 'in_progress') return 'awaiting'
  return current
}

export function CaseDetail({
  c,
  player,
  assessment,
  onClose,
}: {
  c: Case
  player: PlayerProfile | undefined
  assessment: RiskAssessment | undefined
  onClose: () => void
}) {
  const assign = useCaseStore((s) => s.assign)
  const setStatus = useCaseStore((s) => s.setStatus)
  const setPriority = useCaseStore((s) => s.setPriority)
  const addNote = useCaseStore((s) => s.addNote)
  const logIntervention = useStore((s) => s.logIntervention)

  const recommended = Math.max(
    1,
    Math.min(5, assessment?.recommendedLevel ?? 3),
  ) as InterventionLevel
  const [level, setLevel] = useState<InterventionLevel>(recommended)
  const [comms, setComms] = useState(() => commsTemplate(recommended, c.playerHandle))
  const [applied, setApplied] = useState(false)

  const template = ESCALATION[BAND_BY_LEVEL[level]]

  const pickLevel = (l: InterventionLevel) => {
    setLevel(l)
    setComms(commsTemplate(l, c.playerHandle))
    setApplied(false)
  }

  const applyIntervention = () => {
    // Note captures the exact comms the analyst is sending, for the timeline.
    const note = `${template.action} (L${level}). Message to player: "${comms.trim()}"`
    logIntervention(c.playerId, level, template.action, note)
    addNote(c.id, note)
    setStatus(c.id, advancedStatus(c.status))
    setApplied(true)
  }

  const bandColor = assessment?.band.color ?? 'var(--brand)'

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(8,21,26,0.4)' }}
        onClick={onClose}
        aria-hidden
      />
      {/* Drawer */}
      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[520px] flex-col border-l"
        style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-pop)' }}
        role="dialog"
        aria-label={`Case ${c.id}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h2 className="text-[20px] font-semibold tracking-[-0.02em]">
                {c.playerHandle}
              </h2>
              {assessment && (
                <RiskBadge band={assessment.band} score={assessment.score} size="sm" />
              )}
            </div>
            <div className="mt-1 text-xs text-faint tabular-nums flex flex-wrap gap-x-3">
              <span>{c.id}</span>
              <span>{c.country}</span>
              <span>Opened {relativeTime(c.createdAt)}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost !p-2 shrink-0"
            aria-label="Close case"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scroll body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Player summary + link out */}
          {player && assessment && (
            <section
              className="rounded-lg border p-4"
              style={{ background: assessment.band.tint }}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} style={{ color: bandColor }} className="shrink-0" />
                <span className="text-sm font-bold" style={{ color: bandColor }}>
                  Recommended: Level {ESCALATION[assessment.band.id].level} —{' '}
                  {ESCALATION[assessment.band.id].action}
                </span>
              </div>
              <p className="mt-1 text-xs text-soft leading-relaxed">
                {assessment.topMarkers[0]?.label} · {assessment.topMarkers[1]?.label} ·{' '}
                {assessment.peerPercentile}th percentile in portfolio
              </p>
              <Link
                to={`/players/${c.playerId}`}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold"
                style={{ color: bandColor }}
              >
                Open full player profile <ArrowUpRight size={13} />
              </Link>
            </section>
          )}

          {/* Casework controls */}
          <section className="grid grid-cols-1 gap-4">
            <Field label="Assignee">
              <select
                className="input"
                value={c.assignee}
                onChange={(e) => assign(c.id, e.target.value)}
                aria-label="Assignee"
              >
                <option value={UNASSIGNED}>Unassigned</option>
                {ANALYSTS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Priority">
              <div className="segmented w-full">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(c.id, p)}
                    className={`segmented-btn flex-1 ${c.priority === p ? 'segmented-btn-active' : ''}`}
                  >
                    {PRIORITY_LABEL[p]}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Status">
              <div className="grid grid-cols-2 gap-1.5">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(c.id, s)}
                    className="rounded-lg border py-2 text-[13px] font-semibold transition"
                    style={
                      c.status === s
                        ? {
                            background: 'var(--brand)',
                            color: '#fff',
                            borderColor: 'var(--brand)',
                          }
                        : { background: 'var(--surface-2)' }
                    }
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </Field>
          </section>

          {/* Intervention composer */}
          <section className="rounded-lg border p-4" style={{ background: 'var(--surface-2)' }}>
            <div className="flex items-center gap-2">
              <FileText size={15} style={{ color: 'var(--brand)' }} />
              <h3 className="section-title !text-[15px]">Intervention composer</h3>
            </div>
            <p className="text-xs text-faint mt-0.5">
              Pick an action template, tailor the player message, then apply.
            </p>

            <div className="mt-3">
              <label className="eyebrow">Action template</label>
              <div className="mt-2 grid grid-cols-5 gap-1.5">
                {([1, 2, 3, 4, 5] as InterventionLevel[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => pickLevel(l)}
                    className="rounded-lg border py-2 text-sm font-bold transition"
                    style={
                      level === l
                        ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' }
                        : { background: 'var(--surface)' }
                    }
                  >
                    L{l}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="mt-3 rounded-lg border p-3"
              style={{ background: 'var(--surface)' }}
            >
              <div className="font-semibold text-sm">{template.action}</div>
              <p className="mt-1 text-xs text-soft leading-snug">{template.detail}</p>
              {level === recommended && (
                <span
                  className="mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: 'var(--brand-tint)', color: 'var(--brand-strong)' }}
                >
                  Recommended for this score
                </span>
              )}
            </div>

            <div className="mt-3">
              <label className="eyebrow inline-flex items-center gap-1.5">
                <MessageSquareText size={12} /> Message to player
              </label>
              <textarea
                className="input mt-2 min-h-[104px] resize-none leading-relaxed"
                value={comms}
                onChange={(e) => {
                  setComms(e.target.value)
                  setApplied(false)
                }}
              />
            </div>

            <button
              onClick={applyIntervention}
              disabled={applied || !comms.trim()}
              className="btn btn-primary w-full mt-3"
            >
              {applied ? 'Intervention applied ✓' : 'Apply intervention'}
            </button>
            {applied && (
              <p className="mt-2 text-[11px] text-faint text-center">
                Logged to the audit trail · case moved to “{STATUS_LABEL[c.status]}”.
              </p>
            )}
          </section>

          {/* Notes timeline */}
          <section>
            <h3 className="section-title !text-[15px] mb-3">Notes & activity</h3>
            <NoteTimeline notes={c.notes} onAdd={(text) => addNote(c.id, text)} />
          </section>

          {/* Legend for band mapping (subtle) */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {RISK_BANDS.map((b) => (
              <span
                key={b.id}
                className="inline-flex items-center gap-1 text-[10px] font-medium"
                style={{ color: 'var(--text-faint)' }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: b.color }} />
                {b.label}
              </span>
            ))}
          </div>
        </div>
      </aside>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="eyebrow">{label}</label>
      <div className="mt-2">{children}</div>
    </div>
  )
}
