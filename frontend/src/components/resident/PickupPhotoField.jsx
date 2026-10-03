import { useId, useState } from 'react'
import { ImagePlus, Upload, X } from 'lucide-react'

/**
 * Waste photo upload with preview, drag-and-drop, and replace/remove actions.
 *
 * Styled with the console's own tokens (`r-pf-*`) rather than the older
 * `resident-photo-*` rules, so it sits in the same forms as every other field.
 */
export default function PickupPhotoField({
  label = 'Waste photo',
  hint = 'A clear shot is what the classifier reads',
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
    <div className="r-pf">
      <div className="r-pf-head">
        <label htmlFor={inputId}>{label}</label>
        <span className="r-pf-hint">{hint}</span>
      </div>

      <input
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="r-pf-input"
        disabled={disabled}
        onChange={(e) => {
          pickFile(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />

      {hasPhoto ? (
        <>
          <div className="r-pf-shot">
            <img src={displayUrl} alt="Waste to collect" />
          </div>
          <div className="ac-actions" style={{ marginTop: 0 }}>
            <label htmlFor={inputId} className="ac-btn ac-btn-soft ac-btn-sm">
              <Upload size={14} strokeWidth={2.2} aria-hidden="true" />
              Replace photo
            </label>
            {onClear && (
              <button
                type="button"
                className="ac-btn ac-btn-ghost ac-btn-sm"
                disabled={disabled}
                onClick={() => onClear()}
              >
                <X size={14} strokeWidth={2.2} aria-hidden="true" />
                Remove
              </button>
            )}
          </div>
        </>
      ) : (
        <label
          htmlFor={inputId}
          className={`r-pf-frame${dragOver ? ' is-drag' : ''}${disabled ? ' is-disabled' : ''}`}
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
          <span className="r-pf-icon" aria-hidden="true">
            <ImagePlus size={26} strokeWidth={2} />
          </span>
          <strong>Add a photo of the waste</strong>
          <small>Click to browse, drag one in, or use your camera on a phone</small>
        </label>
      )}
    </div>
  )
}
