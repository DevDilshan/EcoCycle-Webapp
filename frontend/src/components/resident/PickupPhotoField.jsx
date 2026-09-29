import { useId, useState } from 'react'
import { ImagePlus, Upload } from 'lucide-react'

/**
 * Waste photo upload with preview, drag-and-drop, and replace/remove actions.
 */
export default function PickupPhotoField({
  label = 'Waste photo',
  hint = 'Optional — a clear shot helps the classifier',
  existingUrl = '',
  previewUrl = '',
  onFileChange,
  onClear,
  disabled = false,
}) {
  const inputId = useId()
  const [dragOver, setDragOver] = useState(false)
  const displayUrl = previewUrl || existingUrl
  const hasPhoto = Boolean(displayUrl)

  function pickFile(file) {
    if (!file || disabled) return
    if (!file.type.startsWith('image/')) return
    onFileChange(file)
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    pickFile(e.dataTransfer.files?.[0])
  }

  return (
    <div className="resident-photo-field">
      <div className="resident-photo-field-head">
        <label htmlFor={inputId} className="resident-photo-label">
          {label}
        </label>
        <span className="resident-photo-hint">{hint}</span>
      </div>

      <input
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="resident-photo-input"
        disabled={disabled}
        onChange={(e) => {
          pickFile(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />

      {hasPhoto ? (
        <>
          <div className="resident-photo-frame has-preview">
            <img src={displayUrl} alt="Waste to collect" className="resident-photo-preview" />
          </div>
          <div className="resident-photo-actions">
            <label htmlFor={inputId} className="resident-photo-action-btn primary">
              <Upload size={15} aria-hidden />
              Replace photo
            </label>
            {onClear && (
              <button
                type="button"
                className="resident-photo-action-btn ghost"
                disabled={disabled}
                onClick={() => onClear()}
              >
                Remove
              </button>
            )}
          </div>
        </>
      ) : (
        <label
          htmlFor={inputId}
          className={`resident-photo-frame empty${dragOver ? ' drag-over' : ''}${disabled ? ' disabled' : ''}`}
          onDragEnter={(e) => {
            e.preventDefault()
            if (!disabled) setDragOver(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setDragOver(false)
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <span className="resident-photo-icon" aria-hidden>
            <ImagePlus size={26} strokeWidth={2} />
          </span>
          <strong>Upload a photo of the waste</strong>
          <small>Click to browse, drag and drop, or use your camera on mobile</small>
        </label>
      )}
    </div>
  )
}
