import { bandForScore } from '../../lib/riskBands'

/**
 * A single "risk dropped from X to Y" paired bar for one escalation level.
 * The track spans 0-100; the pre-risk marker and the post-risk marker sit on it,
 * with the intervening drop drawn as a coloured segment between them. Honest by
 * construction: if the post marker is *higher* than pre (rare, non-responders),
 * the segment renders red and to the right.
 */
export function BeforeAfterRow({
  level,
  action,
  pre,
  post,
  count,
}: {
  level: number
  action: string
  pre: number
  post: number
  count: number
}) {
  const dropped = post <= pre
  const lo = Math.min(pre, post)
  const hi = Math.max(pre, post)
  const preBand = bandForScore(pre)
  const postBand = bandForScore(post)
  const segColor = dropped ? '#3f8a55' : '#d1432b'
  const delta = Math.round(pre - post)

  return (
    <div className="lift rounded-lg px-3.5 py-3" style={{ background: 'var(--surface-2)' }}>
      <div className="flex items-center gap-2.5">
        <span
          className="rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums shrink-0"
          style={{ background: 'var(--brand-tint)', color: 'var(--brand-strong)' }}
        >
          L{level}
        </span>
        <span className="text-[13px] font-medium truncate flex-1 min-w-0">{action}</span>
        <span className="text-[11px] text-faint tabular-nums shrink-0">n={count}</span>
        <span
          className="text-[13px] font-semibold tabular-nums shrink-0 w-14 text-right"
          style={{ color: segColor }}
        >
          {dropped ? '−' : '+'}
          {Math.abs(delta)}
        </span>
      </div>

      {/* Track: 0-100. Pre & post markers with the drop segment between them. */}
      <div className="relative mt-2.5 h-2.5 rounded-full" style={{ background: 'var(--surface-3)' }}>
        {/* the change segment */}
        <div
          className="absolute top-0 h-full rounded-full"
          style={{
            left: `${lo}%`,
            width: `${Math.max(hi - lo, 0.6)}%`,
            background: segColor,
            opacity: 0.55,
          }}
        />
        {/* post marker (destination) */}
        <span
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${post}%`,
            background: postBand.color,
            boxShadow: '0 0 0 2px var(--surface)',
          }}
          title={`After · ${post}`}
        />
        {/* pre marker (origin, hollow ring) */}
        <span
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${pre}%`,
            background: 'var(--surface)',
            boxShadow: `inset 0 0 0 2.5px ${preBand.color}`,
          }}
          title={`Before · ${pre}`}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] tabular-nums text-faint">
        <span>
          Before <span style={{ color: preBand.color }} className="font-semibold">{pre}</span>
        </span>
        <span>
          After <span style={{ color: postBand.color }} className="font-semibold">{post}</span>
        </span>
      </div>
    </div>
  )
}
