import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import ResidentSidebar from './ResidentSidebar'
import { AdminShellContext } from '../admin/adminShell'

/**
 * The resident console shell.
 *
 * Wears `.admin-console`, the same class the admin and collector layouts carry,
 * so all three sides share one sidebar, top bar, card, pill, drawer and toast
 * implementation. The resident pages used to run on the older `.admin-theme`
 * rules in index.css instead, which left them looking like a different product
 * from the landing page they are reached from.
 */
export default function ResidentLayout() {
  const [navOpen, setNavOpen] = useState(false)

  const closeNav = useCallback(() => setNavOpen(false), [])
  const shell = useMemo(() => ({ openNav: () => setNavOpen(true) }), [])

  // Escape closes the slide-in menu, matching the drawers elsewhere.
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
      <div className="admin-console r-console">
        <ResidentSidebar isOpen={navOpen} onNavigate={closeNav} />
        <div className="ac-main">
          <Outlet />
        </div>
      </div>
      <div
        className={`ac-scrim${navOpen ? ' is-open' : ''}`}
        onClick={closeNav}
        aria-hidden="true"
      />
    </AdminShellContext.Provider>
  )
}
