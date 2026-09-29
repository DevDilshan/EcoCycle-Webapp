import { Bell, Menu, Search } from 'lucide-react'
import { useAdminShell } from './adminShell'

/**
 * The admin console's sticky top bar and scrolling view.
 *
 * Separate from components/PageShell, which the resident and collector pages
 * still use: this markup only has styles inside `.admin-console`, so sharing
 * one component between the two would have left those pages unstyled.
 */
export default function AdminPageShell({
  title,
  description,
  children,
  actions,
  showDate = false,
  showSearch = false,
  showBell = false,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search requests, residents, zones',
  filterBar,
  hasAlerts = false,
}) {
  const { openNav } = useAdminShell()

  const dateLabel = showDate
    ? new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <>
      <header className="ac-top">
        <button
          type="button"
          className="ac-icon-btn ac-menu-btn"
          onClick={openNav}
          aria-label="Open navigation"
          aria-controls="admin-nav"
        >
          <Menu size={20} strokeWidth={2} aria-hidden="true" />
        </button>

        <div>
          <h1>{title}</h1>
          {(dateLabel || description) && (
            <span className="ac-date">{dateLabel || description}</span>
          )}
        </div>

        <div className="ac-top-tools">
          {showSearch && (
            <label className="ac-search">
              <span className="ac-sr-only">Search</span>
              <Search size={16} strokeWidth={2} aria-hidden="true" />
              <input
                type="search"
                value={searchValue}
                onChange={(event) => onSearchChange?.(event.target.value)}
                placeholder={searchPlaceholder}
              />
            </label>
          )}
          {actions}
          {showBell && (
            <button
              type="button"
              className="ac-icon-btn"
              aria-label={hasAlerts ? 'Notifications, items need attention' : 'Notifications'}
            >
              <Bell size={18} strokeWidth={2} aria-hidden="true" />
              {hasAlerts && <span className="ac-pip" aria-hidden="true" />}
            </button>
          )}
        </div>
      </header>

      <main className="ac-view">
        {filterBar}
        {children}
      </main>
    </>
  )
}
