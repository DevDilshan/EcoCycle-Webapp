export default function FilterPills({ options, value, onChange }) {
  return (
    <div className="admin-filter-pills" role="tablist">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          role="tab"
          aria-selected={value === option.key}
          className={`admin-filter-pill ${option.className}${value === option.key ? ' admin-filter-pill-active' : ''}`}
          onClick={() => onChange(option.key)}
        >
          {option.label}
          {option.count != null && ` ${option.count}`}
        </button>
      ))}
    </div>
  )
}
