import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Page through a long list. `page` is zero-based. Renders nothing for one page. */
export function Pager({
  page,
  pageSize,
  total,
  onPage,
  noun = 'rows',
}: {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
  noun?: string
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  const from = page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)

  // Compact page list: first, last, and the neighbours of the current page.
  const shown = [...new Set([0, page - 1, page, page + 1, pages - 1])]
    .filter((p) => p >= 0 && p < pages)
    .sort((a, b) => a - b)

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t" aria-label="Pagination">
      <span className="text-[12.5px] text-faint tabular-nums">
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()} {noun}
      </span>
      <div className="flex items-center gap-1">
        <button
          className="btn btn-ghost !px-2 !py-1.5"
          onClick={() => onPage(page - 1)}
          disabled={page === 0}
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>
        {shown.map((p, i) => (
          <span key={p} className="flex items-center">
            {i > 0 && p - shown[i - 1] > 1 && <span className="px-1 text-faint">…</span>}
            <button
              className={`h-8 min-w-8 px-2 rounded-lg text-[12.5px] font-semibold tabular-nums transition-colors ${
                p === page ? '' : 'hover:bg-[var(--surface-2)]'
              }`}
              style={p === page ? { background: 'var(--brand-tint)', color: 'var(--brand)' } : { color: 'var(--text-soft)' }}
              onClick={() => onPage(p)}
              aria-current={p === page ? 'page' : undefined}
            >
              {p + 1}
            </button>
          </span>
        ))}
        <button
          className="btn btn-ghost !px-2 !py-1.5"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages - 1}
          aria-label="Next page"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </nav>
  )
}
