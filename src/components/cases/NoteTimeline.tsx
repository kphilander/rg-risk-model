import { useState } from 'react'
import { Send } from 'lucide-react'
import type { CaseNote } from '../../store/useCaseStore'
import { relativeTime } from '../../lib/format'

// Vertical notes timeline with a rail + dots, plus an inline composer.
// System-authored notes render in a muted brand tint; analyst notes in the
// accent so casework reads apart from automated events.
export function NoteTimeline({
  notes,
  onAdd,
}: {
  notes: CaseNote[]
  onAdd: (text: string) => void
}) {
  const [draft, setDraft] = useState('')
  const ordered = [...notes].sort((a, b) => (a.ts < b.ts ? -1 : 1))

  const submit = () => {
    if (!draft.trim()) return
    onAdd(draft)
    setDraft('')
  }

  return (
    <div>
      <ol className="relative space-y-4 pl-5">
        {/* rail */}
        <span
          className="absolute left-[3px] top-1 bottom-1 w-px"
          style={{ background: 'var(--hairline)' }}
          aria-hidden
        />
        {ordered.map((n) => {
          const system = n.author === 'system'
          return (
            <li key={n.id} className="relative">
              <span
                className="absolute -left-5 top-1 h-[7px] w-[7px] rounded-full"
                style={{
                  background: system ? 'var(--text-faint)' : 'var(--brand)',
                  boxShadow: '0 0 0 3px var(--surface)',
                }}
                aria-hidden
              />
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: system ? 'var(--text-soft)' : 'var(--text)' }}
                >
                  {system ? 'System' : n.author}
                </span>
                <span className="text-[11px] text-faint tabular-nums whitespace-nowrap">
                  {relativeTime(n.ts)}
                </span>
              </div>
              <p className="mt-0.5 text-[13px] leading-relaxed text-soft">{n.text}</p>
            </li>
          )
        })}
        {ordered.length === 0 && (
          <li className="text-[13px] text-faint">No notes yet.</li>
        )}
      </ol>

      <div className="mt-4 flex items-end gap-2">
        <textarea
          className="input min-h-[44px] resize-none"
          placeholder="Add a case note…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit()
          }}
          rows={2}
        />
        <button
          onClick={submit}
          disabled={!draft.trim()}
          className="btn btn-primary !px-3 shrink-0"
          aria-label="Add note"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}
