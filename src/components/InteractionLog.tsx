import { useMemo, useState, type ReactNode } from 'react'
import { MessageSquarePlus, ShieldAlert, UserCog, X } from 'lucide-react'
import type { InterventionAction, RiskAssessment } from '../types'
import { useStore, useDataAsOf } from '../store/useStore'
import { dateTime, relativeTime } from '../lib/format'
import {
  CATEGORY_COLOR,
  CATEGORY_LABELS,
  INTERACTION_KIND_LABELS,
  INTERACTION_METHODS,
  INTERACTION_METHOD_LABELS,
  INTERACTION_OUTCOME_LABELS,
  INTERACTION_OUTCOMES,
  MARKER_CATEGORIES,
  OBSERVED_MARKERS,
  observedMarker,
  type InteractionKind,
  type InteractionMethod,
  type InteractionOutcome,
} from '../core/observedMarkers'

// Observational kinds that log through the interaction (score-folding) path;
// 'intervention' is routed to the escalation/compliance path instead.
const LOG_KINDS: InteractionKind[] = ['observation', 'rg_conversation', 'follow_up', 'referral']

/** Unified player-activity timeline + the score composition the observations drive.
 *  Interventions and observations live on one timeline; an intervention is just
 *  the activity kind that additionally hits the escalation + compliance path. */
export function InteractionLog({
  playerId,
  assessment,
  onLogIntervention,
}: {
  playerId: string
  assessment: RiskAssessment
  onLogIntervention: () => void
}) {
  const allInteractions = useStore((s) => s.interactions)
  const asOf = useDataAsOf()
  const allInterventions = useStore((s) => s.interventions)
  const logInteraction = useStore((s) => s.logInteraction)

  const timeline = useMemo(() => {
    const ix = allInteractions
      .filter((i) => i.playerId === playerId)
      .map((i) => ({ ts: i.timestamp, kind: 'ix' as const, ix: i }))
    const iv = allInterventions
      .filter((i) => i.playerId === playerId)
      .map((i) => ({ ts: i.timestamp, kind: 'iv' as const, iv: i }))
    return [...ix, ...iv].sort((a, b) => (a.ts < b.ts ? 1 : -1))
  }, [allInteractions, allInterventions, playerId])

  const [logKind, setLogKind] = useState<InteractionKind | null>(null)
  const observed = assessment.observed
  const base = assessment.dataScore ?? assessment.score
  const floored = !!observed && observed.concern === 'open' && observed.floor > base + observed.uplift

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="section-title flex items-center gap-2">
            <UserCog size={17} style={{ color: 'var(--brand)' }} /> Player activity
          </h2>
          <p className="section-sub">
            Interventions and staff observations on one timeline. Observations feed the combined risk score.
          </p>
        </div>
      </div>

      {/* Score composition */}
      {observed && (observed.count > 0 || observed.concern !== 'none') ? (
        <div className="mt-4 rounded-lg p-4" style={{ background: 'var(--surface-2)' }}>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <Term label="Data-derived" value={base} />
            <Op>{floored ? '→' : '+'}</Op>
            {floored ? (
              <Term label="Disclosure floor" value={observed.floor} color="#c46a1c" />
            ) : (
              <Term label="Observations" value={observed.uplift > 0 ? `+${observed.uplift}` : '0'} color="var(--brand)" />
            )}
            <Op>=</Op>
            <Term label="Combined score" value={assessment.score} big color={assessment.band.color} />
            <span
              className="mb-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
              style={{ background: assessment.band.tint, color: assessment.band.color }}
            >
              {assessment.band.label}
            </span>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-soft">
            {floored ? (
              <>
                A recent{' '}
                <strong>
                  {observed.top.find((t) => observedMarker(t.slug)?.critical)?.label ?? 'high-confidence disclosure'}
                </strong>{' '}
                holds this player at {assessment.band.label} regardless of the data-derived score until a follow-up resolves it.
              </>
            ) : observed.concern === 'resolved' ? (
              <>A prior disclosure was <strong>logged and resolved</strong> on follow-up — the floor is cleared.</>
            ) : observed.reassured ? (
              <>Most recent follow-up recorded <strong>no concern</strong> — corroboration is dampened.</>
            ) : observed.uplift > 0 ? (
              <>
                {observed.count} observation{observed.count === 1 ? '' : 's'} add <strong>+{observed.uplift}</strong>. Observations that duplicate what the data already shows count for little; emotional and social markers count in full.
              </>
            ) : (
              <>The recorded observations duplicate what the data already shows, so they add nothing.</>
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {MARKER_CATEGORIES.filter((c) => observed.byCategory[c] > 0.01).map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5 text-[11px] text-faint">
                <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLOR[c] }} />
                {CATEGORY_LABELS[c]}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-[13px] text-faint">
          No staff observations recorded — this player’s score is data-derived only. Log an observation to add staff signal.
        </p>
      )}

      {/* Log activity */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-medium text-soft mr-1">Log activity</span>
        {LOG_KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setLogKind((cur) => (cur === k ? null : k))}
            className="chip focus-ring"
            style={logKind === k ? { background: 'var(--brand-tint)', color: 'var(--brand-strong)', borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)' } : undefined}
          >
            <MessageSquarePlus size={13} /> {INTERACTION_KIND_LABELS[k]}
          </button>
        ))}
        <button onClick={onLogIntervention} className="chip focus-ring" title="Escalation / compliance path">
          <ShieldAlert size={13} /> Intervention
        </button>
      </div>

      {logKind && (
        <LogForm
          kind={logKind}
          onSubmit={(input) => {
            logInteraction(playerId, input)
            setLogKind(null)
          }}
          onClose={() => setLogKind(null)}
        />
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {timeline.map((item) =>
            item.kind === 'iv' ? (
              <InterventionRow key={item.iv.id} iv={item.iv} />
            ) : (
              <div key={item.ix.id} className="rounded-md px-3.5 py-3" style={{ border: '1px solid var(--line)' }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-semibold rounded-full px-2 py-0.5" style={{ background: 'var(--brand-tint)', color: 'var(--brand-strong)' }}>
                    {INTERACTION_KIND_LABELS[item.ix.kind]}
                  </span>
                  <span className="text-[12px] text-faint">{INTERACTION_METHOD_LABELS[item.ix.method]}</span>
                  {item.ix.outcome && (
                    <span className="text-[11px] font-semibold rounded-full px-2 py-0.5" style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text-soft)' }}>
                      {INTERACTION_OUTCOME_LABELS[item.ix.outcome]}
                    </span>
                  )}
                  <span className="text-[12px] text-faint tabular-nums ml-auto" title={dateTime(item.ix.timestamp)}>
                    {relativeTime(item.ix.timestamp, asOf)}
                  </span>
                </div>
                {item.ix.markers.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.ix.markers.map((slug) => {
                      const m = observedMarker(slug)
                      if (!m) return null
                      return (
                        <span key={slug} className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORY_COLOR[m.category] }} />
                          {m.label}
                        </span>
                      )
                    })}
                  </div>
                )}
                {item.ix.note && <p className="mt-2 text-[13px] leading-snug text-soft">{item.ix.note}</p>}
                <p className="mt-1.5 text-[11px] text-faint">{item.ix.operator}</p>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  )
}

function InterventionRow({ iv }: { iv: InterventionAction }) {
  return (
    <div className="rounded-md px-3.5 py-3" style={{ border: '1px solid var(--line)', borderLeft: '2px solid var(--accent)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[12px] font-semibold rounded-full px-2 py-0.5" style={{ background: 'var(--brand-tint)', color: 'var(--brand-strong)' }}>
          <ShieldAlert size={12} /> Intervention · L{iv.level}
        </span>
        <span className="text-[12px]">{iv.action}</span>
        <span
          className="text-[11px] font-semibold rounded-full px-2 py-0.5 capitalize"
          style={iv.status === 'resolved' ? { background: 'rgba(52,199,89,0.16)', color: '#4f8a5f' } : { background: 'rgba(255,149,0,0.16)', color: '#c46a1c' }}
        >
          {iv.status === 'logged' ? 'Open' : 'Resolved'}
        </span>
        <span className="text-[12px] text-faint tabular-nums ml-auto" title={dateTime(iv.timestamp)}>
          {relativeTime(iv.timestamp)}
        </span>
      </div>
      {iv.note && <p className="mt-2 text-[13px] leading-snug text-soft">{iv.note}</p>}
      <p className="mt-1.5 text-[11px] text-faint">{iv.operator}</p>
    </div>
  )
}

function Term({ label, value, big, color }: { label: string; value: number | string; big?: boolean; color?: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className={`${big ? 'text-[30px]' : 'text-[22px]'} font-bold tabular-nums leading-none mt-1`} style={{ color: color ?? 'var(--text)', letterSpacing: '-0.02em' }}>
        {value}
      </div>
    </div>
  )
}
function Op({ children }: { children: ReactNode }) {
  return <div className="text-[20px] font-semibold text-faint mb-1.5">{children}</div>
}

function LogForm({
  kind,
  onSubmit,
  onClose,
}: {
  kind: InteractionKind
  onSubmit: (input: { kind: InteractionKind; method: InteractionMethod; markers: string[]; note: string; outcome?: InteractionOutcome }) => void
  onClose: () => void
}) {
  const [method, setMethod] = useState<InteractionMethod>('in_person')
  const [markers, setMarkers] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [outcome, setOutcome] = useState<InteractionOutcome>('ongoing')
  const isFollowUp = kind === 'follow_up'

  const toggle = (slug: string) =>
    setMarkers((m) => (m.includes(slug) ? m.filter((s) => s !== slug) : [...m, slug]))

  // A follow-up can record just an outcome; other kinds need at least one marker.
  const canSubmit = markers.length > 0 || (isFollowUp && outcome !== 'ongoing')

  return (
    <div className="mt-3 rounded-lg p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
      <div className="flex items-center justify-between">
        <span className="eyebrow">New {INTERACTION_KIND_LABELS[kind].toLowerCase()}</span>
        <button onClick={onClose} className="text-faint hover:text-[var(--text)]" aria-label="Cancel"><X size={16} /></button>
      </div>

      <div className={`mt-3 grid grid-cols-1 ${isFollowUp ? 'sm:grid-cols-2' : ''} gap-3`}>
        <label className="block">
          <span className="text-[12px] font-medium text-soft">Method</span>
          <select className="input mt-1" value={method} onChange={(e) => setMethod(e.target.value as InteractionMethod)}>
            {INTERACTION_METHODS.map((m) => <option key={m} value={m}>{INTERACTION_METHOD_LABELS[m]}</option>)}
          </select>
        </label>
        {isFollowUp && (
          <label className="block">
            <span className="text-[12px] font-medium text-soft">Outcome</span>
            <select className="input mt-1" value={outcome} onChange={(e) => setOutcome(e.target.value as InteractionOutcome)}>
              {INTERACTION_OUTCOMES.map((o) => <option key={o} value={o}>{INTERACTION_OUTCOME_LABELS[o]}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="mt-3">
        <span className="text-[12px] font-medium text-soft">
          Observed markers {isFollowUp && <span className="text-faint">(optional for a follow-up)</span>}
        </span>
        <div className="mt-1.5 space-y-2">
          {MARKER_CATEGORIES.map((cat) => (
            <div key={cat} className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-faint w-24 shrink-0">
                <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLOR[cat] }} />
                {CATEGORY_LABELS[cat]}
              </span>
              {OBSERVED_MARKERS.filter((m) => m.category === cat).map((m) => {
                const on = markers.includes(m.slug)
                return (
                  <button
                    key={m.slug}
                    type="button"
                    onClick={() => toggle(m.slug)}
                    title={m.description}
                    className="rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors"
                    style={
                      on
                        ? { background: 'var(--brand-tint)', color: 'var(--brand-strong)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' }
                        : { background: 'var(--surface)', color: 'var(--text-soft)', border: '1px solid var(--line)' }
                    }
                  >
                    {m.label}
                    {m.critical && <span title="High-confidence signal"> ●</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <label className="block mt-3">
        <span className="text-[12px] font-medium text-soft">Note</span>
        <textarea
          className="input mt-1 min-h-[64px] resize-y"
          placeholder="What did you observe?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button
          className="btn btn-primary"
          disabled={!canSubmit}
          onClick={() => onSubmit({ kind, method, markers, note: note.trim(), outcome: isFollowUp ? outcome : undefined })}
        >
          Log {INTERACTION_KIND_LABELS[kind].toLowerCase()}
        </button>
      </div>
    </div>
  )
}
