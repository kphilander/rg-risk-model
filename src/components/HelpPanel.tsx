import { useState } from 'react'
import { Info, X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { HELP } from '../content/help'

/** Per-page plain-language + technical explanation. Collapsed to a slim chip
 *  until the user opens help (globally via the top-bar "?" or this chip). */
export function HelpPanel({ id }: { id: string }) {
  const helpOpen = useStore((s) => s.helpOpen)
  const toggleHelp = useStore((s) => s.toggleHelp)
  const [tab, setTab] = useState<'plain' | 'technical'>('plain')
  const content = HELP[id]
  if (!content) return null

  if (!helpOpen) {
    return (
      <button
        onClick={toggleHelp}
        className="mb-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:text-[var(--text)]"
        style={{ background: 'var(--surface-2)', color: 'var(--text-faint)' }}
      >
        <Info size={14} /> About this page
      </button>
    )
  }

  return (
    <div className="card reveal mb-5 !p-4" style={{ boxShadow: 'var(--shadow)' }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Info size={15} style={{ color: 'var(--brand)' }} />
          <span className="eyebrow">About this page</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="segmented">
            <button className={`segmented-btn ${tab === 'plain' ? 'segmented-btn-active' : ''}`} onClick={() => setTab('plain')}>
              Plain language
            </button>
            <button className={`segmented-btn ${tab === 'technical' ? 'segmented-btn-active' : ''}`} onClick={() => setTab('technical')}>
              Technical
            </button>
          </div>
          <button
            onClick={toggleHelp}
            aria-label="Close help"
            className="h-7 w-7 rounded-full flex items-center justify-center transition-colors hover:bg-[var(--surface-3)]"
            style={{ color: 'var(--text-faint)' }}
          >
            <X size={15} />
          </button>
        </div>
      </div>
      <div className="mt-3 space-y-2 max-w-3xl">
        {tab === 'plain' ? content.plain : content.technical}
      </div>
    </div>
  )
}
