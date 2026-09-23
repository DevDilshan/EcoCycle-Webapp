import AdminSearchBar from './AdminSearchBar'

export default function AdminHeaderToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search requests, residents…',
  showSearch = true,
  showBell = true,
}) {
  return (
    <div className="admin-header-toolbar">
      {showSearch && (
        <AdminSearchBar
          value={searchValue}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
        />
      )}
      {showBell && (
        <button type="button" className="admin-bell-btn" aria-label="Notifications">
          🔔
        </button>
      )}
    </div>
  )
}
