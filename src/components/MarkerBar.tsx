import { Link } from 'react-router-dom'
import { Info, ArrowRight } from 'lucide-react'
import type { MarkerResult } from '../types'
import { bandForScore } from '../lib/riskBands'
import { domainForMarker } from '../lib/markerDomains'
import { MARKER_INFO } from '../content/markerInfo'
import { MODEL_CARD } from '../lib/modelCard'
import { InfoPopover } from './InfoPopover'

/** A single behavioral marker rendered as a labelled progress bar with reason.
 *  The label is click-to-open: it reveals what the marker means plus its
 *  evidence weight, so an operator can drill into any indicator in place. */
export function MarkerBar({ marker, showReason = true }: { marker: MarkerResult; showReason?: boolean }) {
  const color = bandForScore(marker.score).color
  const muted = marker.score < 15
  const ev = MODEL_CARD.markers.find((x) => x.id === marker.id)
  const domain = domainForMarker(marker.id)
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <InfoPopover
          align="left"
          width={300}
          title={marker.label}
          triggerLabel={`What “${marker.label}” means`}
          triggerClassName="focus-ring group inline-flex items-center gap-1.5 rounded-md -mx-1 px-1 text-sm font-medium"
          trigger={
            <>
              <span style={{ color: muted ? 'var(--text-faint)' : 'var(--text)' }}>{marker.label}</span>
              <Info size={13} className="shrink-0 text-faint opacity-40 transition-opacity group-hover:opacity-100" />
            </>
          }
        >
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: domain.color }} />
            <span className="text-[11px] font-semibold text-faint">{domain.label} domain</span>
          </div>
          {MARKER_INFO[marker.id] && <p>{MARKER_INFO[marker.id]}</p>}
          {ev && (
            <p className="text-faint">
              Weight <b className="text-soft">{ev.weight.toFixed(2)}</b> ·{' '}
              {ev.fitted ? `fitted${ev.auc != null ? ` (AUC ${ev.auc.toFixed(2)})` : ''}` : 'informed prior'} · {ev.source}
            </p>
          )}
          <Link to="/governance" className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--brand)' }}>
            View model card <ArrowRight size={13} />
          </Link>
        </InfoPopover>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-faint tabular-nums">{marker.value}</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: muted ? 'var(--text-faint)' : color }}>
            {Math.round(marker.score)}
          </span>
        </div>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${marker.score}%`, background: color, transition: 'width 0.5s ease' }}
        />
      </div>
      {showReason && !muted && (
        <p className="mt-1.5 text-xs leading-snug text-soft">{marker.explanation}</p>
      )}
    </div>
  )
}
