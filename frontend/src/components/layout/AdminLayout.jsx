import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { AdminShellContext } from '../admin/adminShell'
import { AdminCatalogProvider } from '../../hooks/useAdminCatalog'

export default function AdminLayout() {
  const [navOpen, setNavOpen] = useState(false)

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
      <AdminCatalogProvider>
        {/* admin-theme is kept so existing rules that other admin markup still
            relies on keep working; admin-console is what the redesign targets. */}
        <div className="admin-console admin-theme">
          <Sidebar isOpen={navOpen} onNavigate={closeNav} />
          <div className="ac-main">
            <Outlet />
          </div>
        </div>
        <div
          className={`ac-scrim${navOpen ? ' is-open' : ''}`}
          onClick={closeNav}
          aria-hidden="true"
        />
      </AdminCatalogProvider>
    </AdminShellContext.Provider>
  )
}
