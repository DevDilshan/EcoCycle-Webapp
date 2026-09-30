import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * A modal "are you sure?" that replaces the browser's native confirm().
 *
 * Cancel is focused first, so a stray Enter keeps the data rather than
 * destroying it. Escape and a click on the backdrop also cancel.
 */
export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Keep it', danger = false, onConfirm, onCancel }) {
  const cancelRef = useRef(null)

  useEffect(() => {
    cancelRef.current?.focus()
    function onKeyDown(event) {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return createPortal(
    <div className="ecoc-confirm-scrim" onClick={onCancel}>
      <div
        className="ecoc-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ecoc-confirm-title"
        aria-describedby="ecoc-confirm-message"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="ecoc-confirm-title">{title}</h2>
        <p id="ecoc-confirm-message">{message}</p>
        <div className="ecoc-confirm-actions">
          <button type="button" className="ecoc-confirm-cancel" ref={cancelRef} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`ecoc-confirm-ok${danger ? ' is-danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
