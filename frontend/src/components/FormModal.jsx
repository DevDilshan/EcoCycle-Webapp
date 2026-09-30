import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/**
 * A pop-up window for create and edit forms.
 *
 * It renders inside the admin console when there is one, so the console's form
 * styles and colour variables still apply, and into <body> elsewhere (the
 * resident pages). Escape and the backdrop close it; the first field is
 * focused when it opens.
 */
export default function FormModal({ open, title, subtitle, onClose, children }) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const field = panelRef.current?.querySelector('input:not([type=checkbox]), select, textarea')
    field?.focus()

    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="ecoc-modal-scrim" onMouseDown={onClose}>
      <div
        className="ecoc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ecoc-modal-title"
        ref={panelRef}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="ecoc-modal-head">
          <div>
            <h2 id="ecoc-modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="ecoc-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
        <div className="ecoc-modal-body">{children}</div>
      </div>
    </div>,
    document.querySelector('.admin-console') || document.body,
  )
}
