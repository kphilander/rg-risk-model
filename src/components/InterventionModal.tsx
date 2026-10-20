import { useEffect, useState } from 'react'
import { X, ShieldCheck } from 'lucide-react'
import type { InterventionLevel, PlayerProfile, RiskAssessment } from '../types'
import { ESCALATION } from '../lib/riskBands'
import { guideFor } from '../core/jurisdictions'
import { useStore } from '../store/useStore'

const LEVELS: { level: InterventionLevel; action: string; detail: string }[] = [
  { level: 1, ...pick('low') },
  { level: 2, ...pick('moderate') },
  { level: 3, ...pick('elevated') },
  { level: 4, ...pick('high') },
  { level: 5, ...pick('critical') },
]

function pick(id: keyof typeof ESCALATION) {
  return { action: ESCALATION[id].action, detail: ESCALATION[id].detail }
}

export function InterventionModal({
  player,
  assessment,
  onClose,
}: {
  player: PlayerProfile
  assessment: RiskAssessment
  onClose: () => void
}) {
  const logIntervention = useStore((s) => s.logIntervention)
  const [level, setLevel] = useState<InterventionLevel>(
    Math.max(1, Math.min(5, assessment.recommendedLevel)) as InterventionLevel,
  )
  const [note, setNote] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const selected = LEVELS.find((l) => l.level === level)!
  const guide = guideFor(player.jurisdiction)

  const submit = () => {
    logIntervention(player.id, level, selected.action, note.trim())
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(8,21,26,0.55)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border"
        style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={18} style={{ color: 'var(--brand)' }} />
            <div>
              <h3 className="font-bold">Log intervention</h3>
              <p className="text-xs text-faint">
                {player.handle} · risk {assessment.score}/100
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost !p-2" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="eyebrow">Escalation level</label>
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {LEVELS.map((l) => (
                <button
                  key={l.level}
                  onClick={() => setLevel(l.level)}
                  className="rounded-lg border py-2 text-sm font-bold transition"
                  style={
                    level === l.level
                      ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' }
                      : { background: 'var(--surface-2)' }
                  }
                >
                  L{l.level}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-3" style={{ background: 'var(--surface-2)' }}>
            <div className="font-semibold text-sm">{selected.action}</div>
            <p className="mt-1 text-xs text-soft leading-snug">{selected.detail}</p>
            {level === assessment.recommendedLevel && (
              <span
                className="mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: 'var(--brand-tint)', color: 'var(--brand-strong)' }}
              >
                Recommended for this score
              </span>
            )}
          </div>

          <div className="rounded-lg border p-3" style={{ background: 'var(--surface-2)' }}>
            <div className="flex items-center justify-between gap-2">
              <span className="eyebrow">Jurisdiction guidance</span>
              <span className="text-[11px] font-semibold text-soft tabular-nums">
                {guide.name} · {guide.id}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
              <div>
                <div className="text-[10px] font-semibold text-faint">Helpline</div>
                <div className="text-sm font-bold tabular-nums" style={{ color: 'var(--brand)' }}>{guide.helpline}</div>
                <div className="text-[11px] text-faint leading-snug">{guide.helplineLabel}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-faint">Regulator</div>
                <div className="text-[12.5px] font-semibold leading-snug">{guide.regulator}</div>
                <div className="text-[11px] text-faint leading-snug">Minimum age {guide.age}+</div>
              </div>
            </div>
            <p className="mt-2 pt-2 text-[11px] text-soft leading-snug" style={{ borderTop: '1px solid var(--hairline)' }}>
              {guide.mandatory}
            </p>
          </div>

          <div>
            <label className="eyebrow">Case note (optional)</label>
            <textarea
              className="input mt-2 min-h-[80px] resize-none"
              placeholder="Add context for the audit trail…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-4">
          <button onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button onClick={submit} className="btn btn-primary">
            Log to audit trail
          </button>
        </div>
      </div>
    </div>
  )
}
