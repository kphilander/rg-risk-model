import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, Bell, ShieldCheck, ShieldAlert, Scale, FolderKanban, Radar, Activity, Gauge, FlaskConical, Cpu, Database, Dices, X, MessageSquareText } from 'lucide-react'
import { Logo } from '../Logo'
import { useStore } from '../../store/useStore'

const NAV_GROUPS = [
  {
    section: 'Monitor',
    items: [
      { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/players', label: 'Players', icon: Users, end: false },
      { to: '/foresight', label: 'Foresight', icon: Radar, end: false },
      { to: '/games', label: 'Game risk', icon: Dices, end: false },
      { to: '/alerts', label: 'Alerts', icon: Bell, end: false },
    ],
  },
  {
    section: 'Act',
    items: [
      { to: '/cases', label: 'Cases', icon: FolderKanban, end: false },
      { to: '/assistant', label: 'Assistant', icon: MessageSquareText, end: false },
    ],
  },
  {
    section: 'Prove',
    items: [
      { to: '/efficacy', label: 'Efficacy', icon: Activity, end: false },
      { to: '/fairness', label: 'Fairness', icon: Gauge, end: false },
      { to: '/compliance', label: 'Compliance', icon: ShieldCheck, end: false },
      { to: '/governance', label: 'Governance', icon: Scale, end: false },
    ],
  },
  {
    section: 'Build',
    items: [
      { to: '/lab', label: 'Lab', icon: FlaskConical, end: false },
      { to: '/model', label: 'Model', icon: Cpu, end: false },
      { to: '/data', label: 'Import data', icon: Database, end: false },
    ],
  },
]

function useOpenAlerts() {
  return useStore(
    (s) =>
      s.players.filter((p) => (s.assessments.get(p.id)?.recommendedLevel ?? 0) >= 3)
        .length,
  )
}

/** Navigation groups + demo notice — shared by the desktop rail and the mobile drawer. */
function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const openAlerts = useOpenAlerts()
  return (
    <>
      <nav className="flex-1 min-h-0 overflow-y-auto p-3" aria-label="Main">
        {NAV_GROUPS.map(({ section, items }) => (
          <div key={section} className="space-y-1 pb-2">
            <div className="eyebrow px-3 pb-2 pt-3">{section}</div>
            {items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'nav-link-active' : ''}`
                }
              >
                <Icon size={18} strokeWidth={2} />
                <span className="flex-1">{label}</span>
                {to === '/alerts' && openAlerts > 0 && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                    style={{ background: '#d1432b', color: '#fff' }}
                  >
                    {openAlerts}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t">
        <div
          className="rounded-lg p-3 flex gap-2.5 items-start"
          style={{ background: 'var(--surface-2)' }}
        >
          <ShieldAlert size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--brand)' }} />
          <p className="text-[11px] leading-snug text-faint">
            Demonstration environment. All player data is synthetic and
            statistically modelled — it contains no real player records.
          </p>
        </div>
      </div>
    </>
  )
}

/** Persistent navigation rail (lg and up). */
export function Sidebar() {
  return (
    <aside className="material-bar hidden lg:flex w-64 shrink-0 flex-col border-r">
      <div className="h-16 flex items-center px-5 border-b shrink-0">
        <Logo />
      </div>
      <SidebarBody />
    </aside>
  )
}

/** Slide-over navigation drawer (below lg). Opened from the top-bar menu button. */
export function MobileNav() {
  const open = useStore((s) => s.navOpen)
  const setNavOpen = useStore((s) => s.setNavOpen)
  const scoreBasis = useStore((s) => s.scoreBasis)
  const setScoreBasis = useStore((s) => s.setScoreBasis)
  const { pathname } = useLocation()

  // Close on route change and on Escape.
  useEffect(() => setNavOpen(false), [pathname, setNavOpen])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setNavOpen])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
      <button
        className="absolute inset-0 w-full h-full cursor-default"
        style={{ background: 'rgba(0,0,0,0.38)' }}
        aria-label="Close navigation"
        onClick={() => setNavOpen(false)}
      />
      <aside
        className="drawer-in absolute inset-y-0 left-0 w-72 max-w-[85vw] flex flex-col border-r shadow-2xl"
        style={{ background: 'var(--surface)' }}
      >
        <div className="h-16 flex items-center justify-between px-5 border-b shrink-0">
          <Logo />
          <button className="btn btn-ghost !px-2" onClick={() => setNavOpen(false)} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>
        <div className="px-4 pt-4 md:hidden">
          <div className="eyebrow pb-2">Score basis</div>
          <div className="segmented w-full">
            <button
              className={`segmented-btn flex-1 ${scoreBasis === 'combined' ? 'segmented-btn-active' : ''}`}
              onClick={() => setScoreBasis('combined')}
            >
              Combined
            </button>
            <button
              className={`segmented-btn flex-1 ${scoreBasis === 'data' ? 'segmented-btn-active' : ''}`}
              onClick={() => setScoreBasis('data')}
            >
              Data-only
            </button>
          </div>
        </div>
        <SidebarBody onNavigate={() => setNavOpen(false)} />
      </aside>
    </div>
  )
}
