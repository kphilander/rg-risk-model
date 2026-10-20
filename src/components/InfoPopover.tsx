import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

interface InfoPopoverProps {
  /** The clickable element (icon, row, chip …). Rendered inside a <button>. */
  trigger: ReactNode
  /** Popover body. */
  children: ReactNode
  /** Small uppercase heading at the top of the popover. */
  title?: string
  /** Horizontal anchor of the floating card relative to the trigger. */
  align?: 'left' | 'center' | 'right'
  /** Fixed popover width in px. */
  width?: number
  /** Classes for the trigger button (so a whole row can be the trigger). */
  triggerClassName?: string
  /** Accessible label when the trigger is icon-only. */
  triggerLabel?: string
  /** Stretch the wrapper to the full width of its container (for full-row triggers). */
  block?: boolean
}

/**
 * Lightweight click-to-open popover for surfacing definitions and drill-in
 * detail without navigating away. Dismisses on outside-click or Escape.
 */
export function InfoPopover({
  trigger,
  children,
  title,
  align = 'center',
  width = 288,
  triggerClassName = '',
  triggerLabel,
  block = false,
}: InfoPopoverProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const alignCls =
    align === 'right' ? 'right-0' : align === 'left' ? 'left-0' : 'left-1/2 -translate-x-1/2'

  return (
    <span ref={wrapRef} className={block ? 'relative flex w-full' : 'relative inline-flex'}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={triggerLabel}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          className={`popover-in absolute z-50 top-[calc(100%+8px)] ${alignCls}`}
          style={{ width }}
        >
          <div className="card !p-4" style={{ boxShadow: 'var(--shadow-pop)' }}>
            {title && <div className="eyebrow mb-1.5">{title}</div>}
            <div className="text-[13px] text-soft leading-relaxed space-y-2">{children}</div>
          </div>
        </div>
      )}
    </span>
  )
}
