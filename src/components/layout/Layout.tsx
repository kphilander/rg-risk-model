import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { MobileNav, Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { HelpPanel } from '../HelpPanel'

// Map a route to its help-content id (see src/content/help.tsx).
const HELP_ROUTES: Record<string, string> = {
  '/': 'overview',
  '/players': 'players',
  '/alerts': 'alerts',
  '/foresight': 'foresight',
  '/cases': 'cases',
  '/assistant': 'assistant',
  '/efficacy': 'efficacy',
  '/fairness': 'fairness',
  '/lab': 'lab',
  '/model': 'model',
  '/games': 'games',
  '/data': 'data',
  '/compliance': 'compliance',
  '/governance': 'governance',
}

function helpIdFor(pathname: string): string | undefined {
  if (pathname.startsWith('/players/')) return 'playerDetail'
  return HELP_ROUTES[pathname]
}

export function Layout({ children }: { children: ReactNode }) {
  const helpId = helpIdFor(useLocation().pathname)
  return (
    <div className="flex h-full" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <MobileNav />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1360px] px-5 lg:px-8 py-7 lg:py-9">
            {helpId && <HelpPanel id={helpId} />}
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
