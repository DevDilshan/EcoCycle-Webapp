import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import CollectorSidebar from './CollectorSidebar'
import { AdminShellContext } from '../admin/adminShell'
import { CollectorRouteContext } from '../collector/collectorShell'
import { useCollectorRoute } from '../../hooks/useCollectorRoute'

export default function CollectorLayout() {
  const [navOpen, setNavOpen] = useState(false)
  // Fetched here rather than per page, so the sidebar badge and both screens
  // always agree about the same round.
  const route = useCollectorRoute()

  const closeNav = useCallback(() => setNavOpen(false), [])
  const shell = useMemo(() => ({ openNav: () => setNavOpen(true) }), [])

  // Escape closes the slide-in menu, matching the drawer behaviour elsewhere.
  useEffect(() => {
    if (!navOpen) return undefined
    function onKeyDown(event) {
      if (event.key === 'Escape') closeNav()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navOpen, closeNav])

  return (
    <AdminShellContext.Provider value={shell}>
      <CollectorRouteContext.Provider value={route}>
        {/* The same console shell the admin uses, so the two sides share one
            sidebar, top bar, card and drawer implementation. */}
        <div className="admin-console">
          <CollectorSidebar isOpen={navOpen} onNavigate={closeNav} />
          <div className="ac-main">
            <Outlet />
          </div>
        </div>
        <div
          className={`ac-scrim${navOpen ? ' is-open' : ''}`}
          onClick={closeNav}
          aria-hidden="true"
        />
      </CollectorRouteContext.Provider>
    </AdminShellContext.Provider>
  )
}
