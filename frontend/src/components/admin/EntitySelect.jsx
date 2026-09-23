export default function EntitySelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  required = false,
  disabled = false,
  id,
}) {
  return (
    <div>
      {label && <label htmlFor={id}>{label}</label>}
      <select
        id={id}
        className="admin-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}
