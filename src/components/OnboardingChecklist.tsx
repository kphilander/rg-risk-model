import { BRAND } from '../brand'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Rocket, X } from 'lucide-react'
import { useStore } from '../store/useStore'

// Persisted-dismissal flag. Namespaced to the app, versioned so a future
// checklist revision can re-surface without colliding with this one.
const DISMISS_KEY = `${BRAND.slug}.onboarding.v1`

function loadDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}
function saveDismissed(dismissed: boolean) {
  try {
    if (dismissed) localStorage.setItem(DISMISS_KEY, '1')
    else localStorage.removeItem(DISMISS_KEY)
  } catch {
    /* ignore */
  }
}

interface Step {
  title: string
  desc: string
  to: string
  cta: string
  done: boolean
}

/** First-run guidance: the path from the synthetic demo → an operator's own
 *  data + a calibrated model. Step completion is derived from live store state,
 *  so it self-checks as the analyst works. Dismissible + auto-hides once done. */
export function OnboardingChecklist() {
  const importedLabels = useStore((s) => s.importedLabels)
  const provenance = useStore((s) => s.riskModel.provenance)
  const interventions = useStore((s) => s.interventions)

  const [dismissed, setDismissed] = useState(loadDismissed)

  const dismiss = () => {
    saveDismissed(true)
    setDismissed(true)
  }
  const reopen = () => {
    saveDismissed(false)
    setDismissed(false)
  }

  const steps: Step[] = [
    {
      title: 'Explore the demo',
      desc: "You're viewing a synthetic, statistically-modelled portfolio — safe to click anything.",
      to: '/players',
      cta: 'Browse players',
      done: true,
    },
    {
      title: 'Bring your own data',
      desc: 'A single wagers export is enough; columns auto-map, nothing leaves your browser.',
      to: '/data',
      cta: 'Import data',
      done: importedLabels !== null,
    },
    {
      title: 'Calibrate the model',
      desc: 'Fit the risk model to your population and adopt it.',
      to: '/model',
      cta: 'Open Model studio',
      done: provenance === 'operator-fit' || provenance === 'manual',
    },
    {
      title: 'Review & act',
      desc: 'Work the alert queue and log interventions.',
      to: '/alerts',
      cta: 'Go to alerts',
      done: interventions.length > 0,
    },
  ]

  const completed = steps.filter((s) => s.done).length
  const allDone = completed === steps.length
  const pct = Math.round((completed / steps.length) * 100)

  // Auto-hide for power users: once every step is complete, treat it as done
  // and stop nagging (no re-open chip either — there's nothing left to do).
  if (allDone) return null

  if (dismissed) {
    return (
      <div className="mb-6 flex justify-end">
        <button
          onClick={reopen}
          className="chip focus-ring transition-colors hover:text-[var(--text)]"
          style={{ cursor: 'pointer' }}
        >
          <Rocket size={13} style={{ color: 'var(--brand)' }} />
          Getting started · {completed}/{steps.length}
        </button>
      </div>
    )
  }

  const nextIdx = steps.findIndex((s) => !s.done)

  return (
    <div className="card mb-6 !py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'var(--accent-weak)', color: 'var(--brand)' }}
          >
            <Rocket size={16} />
          </div>
          <div className="min-w-0">
            <span className="eyebrow">Get started</span>
            <h2 className="text-[15px] font-semibold leading-tight mt-0.5" style={{ color: 'var(--text)' }}>
              From this demo to monitoring your own players
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2">
            <div className="h-1.5 w-28 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
              <div className="h-full rounded-full gradient-cool transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[12px] font-semibold tabular-nums text-faint">
              {completed}/{steps.length}
            </span>
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss getting started"
            className="focus-ring h-7 w-7 shrink-0 rounded-full flex items-center justify-center transition-colors hover:bg-[var(--surface-2)]"
            style={{ color: 'var(--text-faint)' }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Steps — one tile each; only the next open step gets the primary action. */}
      <ol className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, i) => {
          const isNext = i === nextIdx
          return (
            <li
              key={step.to}
              className="flex flex-col rounded-lg p-3.5"
              style={{
                background: 'var(--surface-2)',
                boxShadow: isNext ? 'inset 0 0 0 1.5px var(--brand)' : undefined,
              }}
            >
              <div className="flex items-center gap-2.5">
                {step.done ? (
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'var(--brand)', color: 'var(--on-accent)' }}
                    aria-label="Complete"
                  >
                    <Check size={13} strokeWidth={3} />
                  </span>
                ) : (
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold tabular-nums"
                    style={{ border: '1.5px solid var(--hair-strong)', color: 'var(--text-faint)' }}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                )}
                <div className="text-[13.5px] font-semibold leading-tight" style={{ color: 'var(--text)' }}>
                  {step.title}
                </div>
              </div>
              <div className="text-[12.5px] text-faint mt-1.5 leading-snug flex-1">{step.desc}</div>
              <Link
                to={step.to}
                className={`btn mt-3 self-start !px-3 !py-1.5 !text-[12.5px] ${isNext ? 'btn-primary' : 'btn-ghost'}`}
              >
                {step.cta}
                <ArrowRight size={13} />
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
