export default function AdminAlert({ type = 'error', message, onClose }) {
  if (!message) return null
  return (
    <div className={`admin-alert admin-alert-${type}`}>
      <span>{message}</span>
      {onClose && (
        <button type="button" className="admin-alert-close" onClick={onClose} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  )
}
