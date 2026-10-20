import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

/** Progressive-disclosure section: a quiet one-line header (title + summary)
 *  that expands to the full content on click. Pages lead with the answer;
 *  the evidence is one click away. `flush` removes body padding for tables. */
export function Disclosure({
  title,
  summary,
  defaultOpen = false,
  flush = false,
  children,
}: {
  title: string
  /** One-line answer/summary shown while collapsed (and as context when open). */
  summary?: ReactNode
  defaultOpen?: boolean
  flush?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="card-flush">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="focus-ring flex w-full items-baseline gap-3 px-6 py-4 text-left transition-colors hover:bg-[var(--surface-2)]"
      >
        <span className="section-title shrink-0">{title}</span>
        {summary && <span className="text-[13px] text-faint truncate">{summary}</span>}
        <ChevronDown
          size={16}
          className={`ml-auto shrink-0 self-center text-faint transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className={flush ? '' : 'px-6 pb-5 pt-1'} style={{ borderTop: '1px solid var(--hairline)' }}>
          {children}
        </div>
      )}
    </section>
  )
}
