import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { apiRequest } from '../../lib/api'
import { REWARD_IMAGES } from '../../lib/rewardImages'
import RewardImage from './RewardImage'

export default function RewardImagePicker({ value, onChange, error, onBusyChange }) {
  const [mode, setMode] = useState(value?.startsWith('https:') ? 'url' : 'gallery')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const uploadController = useRef(null)

  async function upload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploadError(null)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024 || !file.size) {
      setUploadError('Choose a JPEG, PNG or WebP image, up to 5 MB.')
      return
    }
    setUploading(true)
    const controller = new AbortController()
    uploadController.current = controller
    onBusyChange?.(true)
    try {
      const data = new FormData()
      data.append('file', file)
      const result = await apiRequest('/reward-items/image', { method: 'POST', body: data, signal: controller.signal })
      onChange(result.imageUrl)
    } catch (err) { if (err.name !== 'AbortError') setUploadError(err.message) }
    finally { uploadController.current = null; setUploading(false); onBusyChange?.(false) }
  }

  return (
    <div className="ac-field">
      <strong id="item-art-label">Item image</strong>
      <div className="ac-chips" role="group" aria-label="Image source">
        {[['gallery', 'Choose artwork'], ['upload', 'Upload image'], ['url', 'Image URL']].map(([key, label]) => (
          <button key={key} type="button" className={`ac-chip${mode === key ? ' is-on' : ''}`}
            aria-pressed={mode === key} disabled={uploading} onClick={() => { setMode(key); setUploadError(null) }}>{label}</button>
        ))}
      </div>
      <p className="ac-sub">{mode === 'gallery' ? 'Choose a matching image from the EcoCycle artwork collection.'
        : mode === 'upload' ? 'Upload a product photo from your device. JPEG, PNG or WebP, up to 5 MB.'
        : 'Paste a public HTTPS image link. The preview below shows the image you choose.'}</p>
      {mode === 'gallery' && <div className="reward-art-options" role="group" aria-labelledby="item-art-label">
        {REWARD_IMAGES.map(image => (
          <button key={image.key} type="button" className="reward-art-option"
            aria-label={`Use ${image.label} image`} aria-pressed={value === image.url}
            onClick={() => onChange(image.url)}>
            <RewardImage src={image.url} /><span>{image.label}</span>
          </button>
        ))}
      </div>}
      {mode === 'upload' && <label className="reward-upload">
        <Upload size={22} aria-hidden="true" />
        <strong>{uploading ? 'Uploading image…' : 'Choose a photo from your device'}</strong>
        <span>JPEG, PNG or WebP · up to 5 MB</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload reward image" disabled={uploading} onChange={upload} />
      </label>}
      {mode === 'url' && <>
        <label htmlFor="item-image-url">Image URL</label>
        <input id="item-image-url" type="text" value={value?.startsWith('/') ? '' : value} maxLength={2048}
          placeholder="https://example.com/reward.webp" aria-invalid={Boolean(error)}
          onChange={e => onChange(e.target.value)} />
      </>}
      {uploading && <p role="status" className="ac-sub">Uploading your reward image. Keep this form open.</p>}
      {uploading && <button type="button" className="ac-btn ac-btn-ghost ac-btn-sm"
        onClick={() => uploadController.current?.abort()}>Cancel upload</button>}
      {(error || uploadError) && <p className="ac-field-error" role="alert">{uploadError || error}</p>}
      <div className="reward-selected-art">
        <RewardImage src={value} className="reward-art-preview" />
        <div>
          <p className="ac-sub">{value ? 'Selected image. Save the item to apply it.' : 'No image selected. Choose artwork, upload a photo or use an image URL.'}</p>
          {value && <button type="button" className="ac-btn ac-btn-ghost ac-btn-sm" disabled={uploading}
            onClick={() => { setUploadError(null); onChange('') }}>Remove image</button>}
        </div>
      </div>
    </div>
  )
}
