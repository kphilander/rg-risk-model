import { BRAND } from '../brand'

// Symbol mark: three rising signal bars in a navy tile (the tallest bar in the
// accent mint) beside the two-weight wordmark.
export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="32" height="32" viewBox="0 0 64 64" aria-hidden className="shrink-0">
        <rect width="64" height="64" rx="14" fill="#1B2838" />
        <rect x="14" y="36" width="9" height="14" rx="2.5" fill="#FFFFFF" opacity="0.55" />
        <rect x="27.5" y="26" width="9" height="24" rx="2.5" fill="#FFFFFF" opacity="0.8" />
        <rect x="41" y="14" width="9" height="36" rx="2.5" fill="#00D4AA" />
      </svg>
      {!collapsed && (
        <div className="leading-none">
          <div className="text-[17px] tracking-[-0.02em] whitespace-nowrap">
            <span style={{ fontWeight: 800, color: 'var(--logo-ink)' }}>{BRAND.wordmark[0]}</span>{' '}
            <span style={{ fontWeight: 400, color: 'var(--logo-accent)' }}>{BRAND.wordmark[1]}</span>
          </div>
          <div className="text-[10px] font-medium text-faint mt-1.5">{BRAND.tagline}</div>
        </div>
      )}
    </div>
  )
}
