import type { CasePriority, CaseStatus } from '../../store/useCaseStore'
import { PRIORITY_LABEL, STATUS_LABEL } from '../../store/useCaseStore'

// Priority → colour. Reuses the risk-tier palette so priority reads on the same
// visual scale as the rest of the app (urgent = critical purple, high = red…).
const PRIORITY_COLOR: Record<CasePriority, { color: string; bg: string }> = {
  urgent: { color: '#b81d45', bg: 'rgba(175,82,222,0.16)' },
  high: { color: '#d1432b', bg: 'rgba(255,59,48,0.15)' },
  medium: { color: '#c46a1c', bg: 'rgba(255,149,0,0.16)' },
  low: { color: '#4f8a5f', bg: 'rgba(52,199,89,0.14)' },
}

export function PriorityChip({ priority }: { priority: CasePriority }) {
  const c = PRIORITY_COLOR[priority]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
      {PRIORITY_LABEL[priority]}
    </span>
  )
}

const STATUS_COLOR: Record<CaseStatus, { color: string; bg: string }> = {
  open: { color: '#c46a1c', bg: 'rgba(255,149,0,0.16)' },
  in_progress: { color: 'var(--brand)', bg: 'var(--brand-tint)' },
  awaiting: { color: 'var(--text-soft)', bg: 'var(--surface-2)' },
  resolved: { color: '#4f8a5f', bg: 'rgba(52,199,89,0.16)' },
}

export function StatusPill({ status }: { status: CaseStatus }) {
  const c = STATUS_COLOR[status]
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{ background: c.bg, color: c.color }}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}
