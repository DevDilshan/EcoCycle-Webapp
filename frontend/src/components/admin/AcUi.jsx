import { useEffect } from 'react'
import { CircleCheckBig, TriangleAlert, X } from 'lucide-react'

export function AcCard({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`ac-card ${className}`.trim()}>
      {(title || subtitle || action) && (
        <div className="ac-card-head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function AcKpi({ label, icon, value, unit, foot, alert = false }) {
  return (
    <section className={`ac-card ac-kpi${alert ? ' is-alert' : ''}`}>
      <div className="ac-kpi-top">
        {label}
        <span className="ac-tile">{icon}</span>
      </div>
      <div className="ac-kpi-num">
        {value}
        {unit && <small> {unit}</small>}
      </div>
      {foot && <div className="ac-kpi-foot">{foot}</div>}
    </section>
  )
}

export function AcAlert({ message, onClose }) {
  if (!message) return null
  return (
    <div className="ac-alert" role="alert">
      <TriangleAlert size={18} strokeWidth={2} aria-hidden="true" />
      <span>{message}</span>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss">
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

/** Filter chips. Each carries its own count so the numbers stay honest. */
export function AcChips({ options, value, onChange, label = 'Filter' }) {
  return (
    <div className="ac-chips" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={value === option.key}
          className={`ac-chip${value === option.key ? ' is-on' : ''}`}
          onClick={() => onChange(option.key)}
        >
          {option.label}
          {option.count != null && <b>{option.count}</b>}
        </button>
      ))}
    </div>
  )
}

/**
 * Single-series bars drawn to scale from real counts. Width is a share of the
 * largest value, so an empty set renders nothing rather than a full bar.
 */
export function AcBars({ rows, renderIcon }) {
  const max = Math.max(...rows.map((row) => row.value), 0)
  if (!rows.length) return <p className="ac-empty">Nothing to show yet.</p>
  return (
    <div className="ac-bars" role="list">
      {rows.map((row, index) => (
        <div className="ac-bar-row" role="listitem" key={row.label}>
          <span className="ac-lbl">
            {renderIcon && <span className="ac-cat"><span className="ac-ct">{renderIcon(row)}</span></span>}
            <span>{row.label}</span>
          </span>
          <div className="ac-bar-track">
            <div
              className="ac-bar-fill"
              title={`${row.label}: ${row.value}`}
              style={{
                width: max ? `${((row.value / max) * 100).toFixed(1)}%` : '0%',
                animationDelay: `${index * 80}ms`,
              }}
            />
          </div>
          <span className="ac-v">{row.value}</span>
        </div>
      ))}
    </div>
  )
}

/** Right-hand drawer. Closes on Escape and on the scrim, per the handoff. */
export function AcDrawer({ open, onClose, title, children, headAction }) {
  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  return (
    <>
      <div className={`ac-scrim${open ? ' is-open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside
        className={`ac-drawer${open ? ' is-open' : ''}`}
        aria-label={title}
        aria-hidden={!open}
        role="dialog"
      >
        {open && (
          <>
            <div className="ac-drawer-head">
              <h2>{title}</h2>
              <div className="ac-drawer-head-actions">
                {headAction}
                <button type="button" className="ac-icon-btn" onClick={onClose} aria-label="Close details">
                  <X size={18} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            </div>
            {children}
          </>
        )}
      </aside>
    </>
  )
}

export function AcToast({ message }) {
  return (
    <div className={`ac-toast${message ? ' is-on' : ''}`} role="status">
      {message && (
        <>
          <CircleCheckBig size={18} strokeWidth={2} aria-hidden="true" />
          {message}
        </>
      )}
    </div>
  )
}
