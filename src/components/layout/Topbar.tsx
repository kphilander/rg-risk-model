import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Moon, Sun, Bell, HelpCircle, Menu, CalendarClock } from 'lucide-react'
import { useStore, useDataAsOf } from '../../store/useStore'
import { Logo } from '../Logo'
import { platform } from '../../core/runtime'
import { dateTime, shortDate } from '../../lib/format'

export function Topbar() {
  const navigate = useNavigate()
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const helpOpen = useStore((s) => s.helpOpen)
  const toggleHelp = useStore((s) => s.toggleHelp)
  const setFilters = useStore((s) => s.setFilters)
  const scoreBasis = useStore((s) => s.scoreBasis)
  const setScoreBasis = useStore((s) => s.setScoreBasis)
  const openAlerts = useStore(
    (s) =>
      s.players.filter((p) => (s.assessments.get(p.id)?.recommendedLevel ?? 0) >= 3)
        .length,
  )
  const [q, setQ] = useState('')
  const setNavOpen = useStore((s) => s.setNavOpen)
  const asOf = useDataAsOf()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setFilters({ search: q })
    navigate('/players')
  }

  return (
    <header className="material-bar h-16 shrink-0 border-b flex items-center gap-2 sm:gap-3 px-3 sm:px-4 lg:px-6 sticky top-0 z-20">
      <button
        className="btn btn-ghost !px-2.5 lg:hidden"
        onClick={() => setNavOpen(true)}
        aria-label="Open navigation"
      >
        <Menu size={16} />
      </button>
      <div className="lg:hidden shrink-0">
        <Logo collapsed />
      </div>
      <form onSubmit={submit} className="relative flex-1 min-w-0 max-w-md">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--text-faint)' }}
        />
        <input
          className="input pl-9"
          placeholder="Search players…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search players"
        />
      </form>

      <div className="flex-1 hidden sm:block" />

      {asOf && (
        <span
          className="hidden xl:inline-flex items-center gap-1.5 text-[12px] font-medium text-faint tabular-nums"
          title={`Latest activity in the loaded data: ${dateTime(asOf)}. Data dates are shown relative to this date.`}
        >
          <CalendarClock size={14} />
          Data as of {shortDate(asOf)} {asOf.slice(0, 4)}
        </span>
      )}

      <div
        className="segmented hidden md:inline-flex"
        title="Show the combined score (data + staff observations) or the validated data-only score"
      >
        <button
          className={`segmented-btn ${scoreBasis === 'combined' ? 'segmented-btn-active' : ''}`}
          onClick={() => setScoreBasis('combined')}
        >
          Combined
        </button>
        <button
          className={`segmented-btn ${scoreBasis === 'data' ? 'segmented-btn-active' : ''}`}
          onClick={() => setScoreBasis('data')}
        >
          Data-only
        </button>
      </div>

      <button
        onClick={() => navigate('/alerts')}
        className="btn btn-ghost relative !px-2.5"
        aria-label="View alerts"
        title="Alerts"
      >
        <Bell size={16} />
        {openAlerts > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 rounded-[4px] px-1 py-px text-[10px] font-mono font-medium"
            style={{ background: '#d1432b', color: '#fff' }}
          >
            {openAlerts}
          </span>
        )}
      </button>

      <button
        onClick={toggleHelp}
        className="btn btn-ghost !px-2.5"
        aria-label="Toggle help"
        aria-pressed={helpOpen}
        title={helpOpen ? 'Hide page explanations' : 'Explain this page'}
        style={helpOpen ? { background: 'var(--brand-tint)', color: 'var(--brand)', borderColor: 'transparent' } : undefined}
      >
        <HelpCircle size={16} />
      </button>

      <button
        onClick={toggleTheme}
        className="btn btn-ghost !px-2.5"
        aria-label="Toggle colour theme"
        title="Toggle theme"
      >
        {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
      </button>

      <div
        className="hidden sm:flex flex-col items-end leading-tight pl-2 ml-1 border-l"
        title={`Tenant ${platform.tenant.tenantId} · rule pack ${platform.tenant.jurisdiction}`}
      >
        <span className="text-[12.5px] font-semibold">{platform.tenant.operatorName}</span>
        <span className="text-[11px] text-faint font-mono">{platform.tenant.jurisdiction} rule pack</span>
      </div>
    </header>
  )
}
