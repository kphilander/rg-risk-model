import { UserCircle2 } from 'lucide-react'
import type { Case } from '../../store/useCaseStore'
import { UNASSIGNED } from '../../store/useCaseStore'
import type { RiskAssessment } from '../../types'
import { RiskBadge } from '../RiskBadge'
import { relativeTime } from '../../lib/format'
import { PriorityChip, StatusPill } from './caseTokens'
import { SlaBadge } from './SlaBadge'

// One row in the triage queue. The whole row is clickable to open the detail
// panel; `.lift`-style hover is provided via a surface tint (rows can't lift
// without breaking the table layout).
export function CaseRow({
  c,
  assessment,
  active,
  onSelect,
}: {
  c: Case
  assessment: RiskAssessment | undefined
  active: boolean
  onSelect: () => void
}) {
  const unassigned = c.assignee === UNASSIGNED
  return (
    <tr
      onClick={onSelect}
      className="group cursor-pointer transition-colors"
      style={{ background: active ? 'var(--surface-2)' : undefined }}
    >
      <td className="px-5 py-3 group-hover:bg-[var(--surface-2)] transition-colors">
        <div className="font-semibold group-hover:underline">{c.playerHandle}</div>
        <div className="text-xs text-faint tabular-nums">
          {c.id} · {c.country}
        </div>
      </td>
      <td className="px-3 py-3 group-hover:bg-[var(--surface-2)] transition-colors">
        {assessment ? (
          <RiskBadge band={assessment.band} score={assessment.score} size="sm" />
        ) : (
          <span className="text-xs text-faint">—</span>
        )}
      </td>
      <td className="px-3 py-3 group-hover:bg-[var(--surface-2)] transition-colors">
        <PriorityChip priority={c.priority} />
      </td>
      <td className="px-3 py-3 group-hover:bg-[var(--surface-2)] transition-colors">
        <span
          className="inline-flex items-center gap-1.5 text-sm"
          style={{ color: unassigned ? 'var(--text-faint)' : 'var(--text)' }}
        >
          <UserCircle2 size={15} strokeWidth={2} />
          {unassigned ? 'Unassigned' : c.assignee}
        </span>
      </td>
      <td className="px-3 py-3 group-hover:bg-[var(--surface-2)] transition-colors">
        <StatusPill status={c.status} />
      </td>
      <td className="px-3 py-3 group-hover:bg-[var(--surface-2)] transition-colors">
        <SlaBadge dueAt={c.slaDueAt} resolved={c.status === 'resolved'} />
      </td>
      <td className="px-5 py-3 text-xs text-faint whitespace-nowrap group-hover:bg-[var(--surface-2)] transition-colors">
        {relativeTime(c.createdAt)}
      </td>
    </tr>
  )
}
