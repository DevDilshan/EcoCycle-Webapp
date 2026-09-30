import { useEffect, useRef, useState } from 'react'
import { CircleCheckBig, Trash2, TriangleAlert, X } from 'lucide-react'

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

const TOAST_ICONS = { success: CircleCheckBig, danger: Trash2, warning: TriangleAlert }
const TOAST_LIFETIME = { success: 4500, danger: 4500, warning: 8000 }

/**
 * A notification that appears at the top right and dismisses itself.
 *
 * `message` is a string (a success) or `{ text, tone }` where tone is
 * 'success' (green), 'danger' (red, for deletions) or 'warning' (amber, for
 * problems). Pages keep it in state and `onDone` lets them clear it when the
 * toast goes away, so the same message can appear again next time. Without
 * `onDone` the toast still hides itself.
 */
export function AcToast({ message, onDone, duration }) {
  const [hiddenFor, setHiddenFor] = useState(null)
  const doneRef = useRef(onDone)
  const visible = Boolean(message) && message !== hiddenFor

  const text = typeof message === 'object' && message ? message.text : message
  const tone = (typeof message === 'object' && message?.tone) || 'success'
  const lifetime = duration ?? TOAST_LIFETIME[tone] ?? 4500

  useEffect(() => {
    doneRef.current = onDone
  })

  function dismiss() {
    if (doneRef.current) doneRef.current()
    else setHiddenFor(message)
  }

  useEffect(() => {
    if (!visible) return undefined
    const timer = setTimeout(() => {
      if (doneRef.current) doneRef.current()
      else setHiddenFor(message)
    }, lifetime)
    return () => clearTimeout(timer)
  }, [visible, message, lifetime])

  const Icon = TOAST_ICONS[tone] ?? CircleCheckBig

  return (
    <div className="ac-toast-region" aria-live="polite">
      {visible && (
        <div className={`ac-toast is-${tone}`} role={tone === 'warning' ? 'alert' : 'status'}>
          <span className="ac-toast-icon" aria-hidden="true">
            <Icon size={18} strokeWidth={2.2} />
          </span>
          <span className="ac-toast-text">{text}</span>
          <button type="button" className="ac-toast-close" onClick={dismiss} aria-label="Dismiss notification">
            <X size={16} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
