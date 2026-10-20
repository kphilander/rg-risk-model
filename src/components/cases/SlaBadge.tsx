import { parseISO } from 'date-fns'
import { AlarmClock } from 'lucide-react'

// Compact SLA countdown. Turns red once the due time has passed, amber when the
// window is closing (< 4h left), otherwise a neutral chip.
export function SlaBadge({ dueAt, resolved }: { dueAt: string; resolved?: boolean }) {
  const due = parseISO(dueAt).getTime()
  const diffMs = due - Date.now()
  const overdue = diffMs < 0
  const soon = !overdue && diffMs < 4 * 3_600_000

  if (resolved) {
    return (
      <span className="chip !py-0.5" style={{ color: 'var(--text-faint)' }}>
        SLA met
      </span>
    )
  }

  const label = overdue ? `${humanize(-diffMs)} over` : `${humanize(diffMs)} left`
  const color = overdue ? '#d1432b' : soon ? '#c46a1c' : 'var(--text-soft)'
  const bg = overdue
    ? 'rgba(255,59,48,0.15)'
    : soon
      ? 'rgba(255,149,0,0.16)'
      : 'var(--surface-2)'

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
      style={{ background: bg, color }}
    >
      <AlarmClock size={11} strokeWidth={2.4} />
      {label}
    </span>
  )
}

// Coarse, human-friendly duration: days → hours → minutes.
function humanize(ms: number): string {
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${Math.max(mins, 0)}m`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}
