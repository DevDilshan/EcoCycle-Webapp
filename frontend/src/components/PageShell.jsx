import AdminHeaderToolbar from './admin/AdminHeaderToolbar'

export default function PageShell({
  title,
  description,
  children,
  actions,
  eyebrow = 'Admin',
  showDate = false,
  showSearch = false,
  showBell = false,
  searchValue = '',
  onSearchChange,
  searchPlaceholder,
  filterBar,
}) {
  const dateLabel = showDate
    ? new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  const toolbar = (showSearch || showBell) ? (
    <AdminHeaderToolbar
      showSearch={showSearch}
      showBell={showBell}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
    />
  ) : null

  return (
    <div className="page-shell">
      <header className="page-shell-header">
        <div className="page-shell-intro">
          {eyebrow && <p className="page-shell-eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
          {dateLabel && <p className="page-shell-date">{dateLabel}</p>}
          {description && <p className="page-shell-desc">{description}</p>}
        </div>
        <div className="page-shell-actions">
          {toolbar}
          {actions}
        </div>
      </header>
      {filterBar && <div className="admin-filter-bar">{filterBar}</div>}
      <div className="page-shell-body">{children}</div>
    </div>
  )
}
