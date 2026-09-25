export default function AdminSearchBar({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
}) {
  return (
    <label className={`admin-search-bar ${className}`.trim()}>
      <span className="admin-search-icon" aria-hidden>🔍</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="admin-search-input"
      />
    </label>
  )
}
