import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarCheck,
  ChevronRight,
  MapPin,
  Package,
  Phone,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import PageShell from '../../components/admin/AdminPageShell'
import { AcAlert, AcCard, AcChips, AcModal, AcToast } from '../../components/admin/AcUi'
import { AcCategory, AcStatusPill } from '../../components/admin/AcPills'
import { useAuth } from '../../context/AuthContext'
import { formatCompactDate, formatRequestId } from '../../lib/adminUi'
import { apiRequest } from '../../lib/api'
import { uploadPickupPhoto } from '../../lib/pickupPhoto'
import PickupPhotoField from '../../components/resident/PickupPhotoField'
import CollectionDayPicker from '../../components/resident/CollectionDayPicker'
import ResidentApprovalNotice from '../../components/resident/ResidentApprovalNotice'
import { residentPickupStatusPillKey } from '../../lib/residentPickupApproval'
import { COLLECTION_WINDOW_LABEL } from '../../lib/collectorUi'

/**
 * Whether this request was refused.
 *
 * Not `status === 'Rejected'`. Rejecting only started setting the pickup's own
 * status recently; before that it set the approval record and left the pickup
 * Classified. Those older rows still read "Not approved" on screen, so checking
 * the raw status alone kept offering actions on them that make no sense. The
 * pill key is the same thing the row already displays, so the buttons and the
 * label can no longer disagree.
 */
function isRefused(item) {
  return residentPickupStatusPillKey(item) === 'Rejected'
}

const STATUS_FILTERS = ['', 'Pending', 'Classified', 'Scheduled', 'Completed', 'Rejected']

const STATUS_LABELS = {
  '': 'All',
  Pending: 'Being sorted',
  Classified: 'Classified',
  Scheduled: 'Booked in',
  Completed: 'Collected',
  Rejected: 'Not approved',
}

const emptyForm = {
  description: '',
  photoUrl: '',
  zoneId: '',
  address: '',
  contactPhone: '',
  isBulkRequest: false,
  preferredDate: '',
  isRecurring: false,
  recurrenceInterval: '',
}

// Checked in the browser purely to prompt the resident. The classifier runs
// after submission, so it can never warn them while they can still change the
// answer; a plain word list catches the honest cases at the right moment.
const BULKY_WORDS = [
  'sofa', 'couch', 'settee', 'mattress', 'bed frame', 'wardrobe', 'dresser',
  'furniture', 'armchair', 'table', 'fridge', 'freezer', 'washing machine',
]

function looksBulky(description = '') {
  const text = description.toLowerCase()
  return BULKY_WORDS.some((word) => text.includes(word))
}

const DAY_NAMES = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']

const ALLOWED_INTERVALS = ['Weekly', 'Bi-weekly']
const MAX_FUTURE_DAYS = 365

// Whether a contact number could be dialled. Separators are stripped before the
// digits are counted, so a resident is not refused over a space they cannot see.
// 9 to 15 digits is the E.164 range, so a local 0771234567 and an international
// +94771234567 are both accepted. Mirrors PickupRequestValidation.IsDialable.
function isDialable(phone) {
  const trimmed = (phone || '').trim()
  if (!trimmed) return false
  // A plus is allowed only as the first character.
  const body = trimmed.startsWith('+') ? trimmed.slice(1) : trimmed
  if (/[^0-9\s\-()]/.test(body)) return false
  const digits = body.replace(/[^0-9]/g, '').length
  return digits >= 9 && digits <= 15
}

// When the bulky allowance next resets: the 1st of next month. The server
// counts bulky pickups from the start of the current calendar month, so this is
// the first day a refused resident can book one again. Naming the day is kinder
// than "the 1st", which leaves them to work out which 1st.
function bulkResetLabel() {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return next.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
}

function validatePickupForm(form, { requireZone = false, collectionDays = [], bulkRemaining = null, hasPhoto = null } = {}) {
  const errors = {}
  // Only on create: the update endpoint takes no zone, and the edit form never
  // carries one, so requiring it there would block every edit.
  if (requireZone && !form.zoneId) {
    errors.zoneId = 'Please choose the zone this pickup is in.'
  }
  // A zone is a whole suburb. Without the address the collector has nowhere
  // to stop, so this is required rather than optional.
  if (requireZone) {
    const addr = (form.address || '').trim()
    if (addr.length < 5) {
      errors.address = 'Please give your house number and street.'
    } else if (addr.length > 300) {
      errors.address = 'Address must be 300 characters or fewer.'
    }
    // Required alongside the address: an address can be wrong or hard to find,
    // and a call from the kerb is what stops the visit being written off.
    const phone = (form.contactPhone || '').trim()
    if (!phone) {
      errors.contactPhone = 'Please give a number the crew can call.'
    } else if (!isDialable(phone)) {
      errors.contactPhone = 'Please give a valid contact number, e.g. 0771234567.'
    }
  }
  const desc = (form.description || '').trim()
  if (desc.length === 0) errors.description = 'Please describe the waste to be collected.'
  else if (desc.length < 5) errors.description = 'Description must be at least 5 characters.'
  else if (desc.length > 1000) errors.description = 'Description must be 1000 characters or fewer.'

  // Required on create: the classifier reads the photo, and without one the
  // category rests entirely on how the resident happened to word the
  // description. hasPhoto is null on the edit form, which keeps whatever photo
  // the request already carries.
  if (hasPhoto === false) {
    errors.photoUrl = 'Please add a photo of the waste so it can be classified.'
  }

  // The checkbox is disabled once the allowance is spent, but the box can be
  // ticked while one is left and the allowance spent elsewhere before this
  // submits. Caught here so the resident is told before the photo uploads.
  if (requireZone && form.isBulkRequest && bulkRemaining === 0) {
    errors.isBulkRequest = 'You have no bulky collections left this month.'
  }

  if (!form.preferredDate) {
    errors.preferredDate = 'Please choose a preferred date.'
  } else {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const picked = new Date(form.preferredDate); picked.setHours(0, 0, 0, 0)
    const max = new Date(today); max.setDate(max.getDate() + MAX_FUTURE_DAYS)
    if (Number.isNaN(picked.getTime())) errors.preferredDate = 'Please choose a valid date.'
    else if (picked < today) errors.preferredDate = 'Preferred date cannot be in the past.'
    else if (picked > max) errors.preferredDate = 'Preferred date must be within the next 12 months.'
    // The calendar already blocks these, but a date survives a zone change, so
    // this catches a day that was valid for the zone chosen before.
    else if (collectionDays.length > 0 && !collectionDays.includes(picked.getDay())) {
      errors.preferredDate = 'That zone is not collected on this day.'
    }
  }

  if (form.isRecurring) {
    const interval = (form.recurrenceInterval || '').trim()
    if (!interval) errors.recurrenceInterval = 'Choose how often the pickup repeats.'
    else if (!ALLOWED_INTERVALS.some((a) => a.toLowerCase() === interval.toLowerCase()))
      errors.recurrenceInterval = 'Recurrence must be Weekly or Bi-weekly.'
  }
  return errors
}

// Map an ASP.NET ValidationProblemDetails .errors object to { field: firstMessage }
function mapBackendErrors(details) {
  if (!details) return null
  const out = {}
  for (const [key, msgs] of Object.entries(details)) {
    const field = key.charAt(0).toLowerCase() + key.slice(1)
    out[field] = Array.isArray(msgs) ? msgs[0] : String(msgs)
  }
  return Object.keys(out).length ? out : null
}

function revokeBlobPreview(url) {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
}

function toDateInputValue(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

/**
 * Whether to offer "ask again" on a pickup.
 *
 * Mirrors the backend's own rule, which allows it only when the collection
 * genuinely did not happen: the crew reported the stop missed, or the stop's day
 * has passed and it was never closed off. Anything still booked for a future day
 * is simply not due yet.
 */
function canAskAgain(item) {
  if (item.status === 'Completed' || isRefused(item)) return false
  if (item.lastAttemptStatus === 'Missed') return true
  if (item.lastAttemptStatus !== 'Pending' || !item.lastAttemptDate) return false

  const attempt = new Date(item.lastAttemptDate)
  if (Number.isNaN(attempt.getTime())) return false

  // Counted in the viewer's own day, which is the service's: ServiceClock on
  // the backend turns the day over at midnight in Asia/Colombo. This was
  // briefly compared in UTC to match an earlier backend that used UtcNow, and
  // that backend has since been fixed -- counting in UTC here now would be the
  // thing putting the two 5.5 hours apart.
  const attemptDay = new Date(
    attempt.getUTCFullYear(), attempt.getUTCMonth(), attempt.getUTCDate(),
  )
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return attemptDay < today
}

export default function ResidentPickupsPage() {
  const { role } = useAuth()
  const [items, setItems] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [statusCounts, setStatusCounts] = useState({})
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [createForm, setCreateForm] = useState(emptyForm)
  const [createPhotoFile, setCreatePhotoFile] = useState(null)
  const [createPhotoPreview, setCreatePhotoPreview] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editPhotoFile, setEditPhotoFile] = useState(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState('')
  const [createErrors, setCreateErrors] = useState({})
  const [editErrors, setEditErrors] = useState({})
  const [zones, setZones] = useState([])
  const [bulkAllowance, setBulkAllowance] = useState(null)
  /** null | 'submitting' (photo + save) | 'classifying' (agent pipeline) */
  const [createFlowPhase, setCreateFlowPhase] = useState(null)
  const [cancelId, setCancelId] = useState(null)

  // The zone's day numbers, for the calendar's isDayOpen. The dates themselves
  // are no longer precomputed: the calendar asks about each day it draws.
  // Whether a new bulky collection can still be declared. Unticking one already
  // ticked stays allowed, so the resident cannot get stuck.
  const bulkLocked = bulkAllowance?.remaining === 0 && !createForm.isBulkRequest

  const collectionDays = useMemo(() => {
    const zone = zones.find((z) => z.id === createForm.zoneId)
    return zone?.collectionDays ?? []
  }, [zones, createForm.zoneId])

  const collectionDaysLabel = useMemo(() => {
    const zone = zones.find((z) => z.id === createForm.zoneId)
    if (!zone) return null
    const days = zone.collectionDays ?? []
    if (days.length === 0) return `${zone.name} has no fixed collection days.`
    const names = days.map((d) => DAY_NAMES[d]).filter(Boolean)
    const joined = names.length > 1
      ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
      : names[0]
    return `${zone.name} is collected on ${joined}.`
  }, [zones, createForm.zoneId])

  // Active zones for the dropdown. Its own request so a failure costs the
  // selector, not the page; the submit button still validates before sending.
  useEffect(() => {
    let cancelled = false
    apiRequest('/zones/selectable')
      .then((data) => {
        if (!cancelled) setZones(Array.isArray(data) ? data : data?.items ?? [])
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // The allowance is shown before they book, not enforced after. Re-read after
  // each submission so the remaining count stays honest.
  const loadBulkAllowance = useCallback(() => {
    apiRequest('/pickuprequests/bulk-allowance')
      .then(setBulkAllowance)
      .catch(() => setBulkAllowance(null))
  }, [])

  useEffect(() => { loadBulkAllowance() }, [loadBulkAllowance])

  function setCreatePhoto(file) {
    setCreatePhotoFile(file)
    setCreateErrors((prev) => ({ ...prev, photo: undefined }))
    setCreatePhotoPreview((prev) => {
      revokeBlobPreview(prev)
      return file ? URL.createObjectURL(file) : ''
    })
  }

  function clearCreatePhoto() {
    setCreatePhotoFile(null)
    setCreatePhotoPreview((prev) => {
      revokeBlobPreview(prev)
      return ''
    })
  }

  function setEditPhoto(file) {
    setEditPhotoFile(file)
    setEditErrors((prev) => ({ ...prev, photo: undefined }))
    setEditPhotoPreview((prev) => {
      revokeBlobPreview(prev)
      return file ? URL.createObjectURL(file) : ''
    })
  }

  function clearEditPhotoSelection() {
    setEditPhotoFile(null)
    setEditPhotoPreview((prev) => {
      revokeBlobPreview(prev)
      return ''
    })
  }

  function clearEditPhoto() {
    clearEditPhotoSelection()
    setEditForm((f) => ({ ...f, photoUrl: '' }))
  }

  useEffect(() => () => {
    revokeBlobPreview(createPhotoPreview)
    revokeBlobPreview(editPhotoPreview)
  }, [createPhotoPreview, editPhotoPreview])

  const loadCounts = useCallback(async () => {
    const counts = {}
    await Promise.all(
      STATUS_FILTERS.map(async (status) => {
        const query = new URLSearchParams({ pageSize: '1' })
        if (status) query.set('status', status)
        const data = await apiRequest(`/pickuprequests?${query}`)
        counts[status || 'all'] = data.totalCount
      }),
    )
    setStatusCounts(counts)
  }, [])

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    // A silent reload runs from an error handler to refresh the list; it must
    // not wipe the error message that was just shown to the user.
    if (!silent) setError(null)
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: '20' })
      if (statusFilter) query.set('status', statusFilter)
      const data = await apiRequest(`/pickuprequests?${query}`)
      setItems(data.items)
      setTotalCount(data.totalCount)
    } catch (err) {
      setError(err.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [page, statusFilter])

  const awaitingClassification = useMemo(
    () => items.some((item) => item.status === 'Pending' && !item.category),
    [items],
  )

  useEffect(() => {
    if (!awaitingClassification) return undefined
    const timer = setInterval(() => {
      load({ silent: true })
      loadCounts()
    }, 5000)
    return () => clearInterval(timer)
  }, [awaitingClassification, load, loadCounts])

  useEffect(() => { loadCounts() }, [loadCounts])
  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [statusFilter, search])

  const filterOptions = useMemo(
    () => STATUS_FILTERS
      .filter((s) => s !== 'Rejected' || statusCounts.Rejected)
      .map((status) => ({
        key: status,
        label: STATUS_LABELS[status] || status,
        count: statusCounts[status || 'all'],
      })),
    [statusCounts],
  )

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter((item) => {
      const id = formatRequestId(item.id).toLowerCase()
      const desc = (item.description || '').toLowerCase()
      const addr = (item.address || '').toLowerCase()
      return id.includes(q) || desc.includes(q) || addr.includes(q)
    })
  }, [items, search])

  async function handleRequestAgain(item) {
    setBusyId(item.id)
    setError(null)
    try {
      const result = await apiRequest(`/pickuprequests/${item.id}/request-again`, { method: 'POST' })
      setSuccess(result?.message || 'Booked onto a collector’s round again.')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  // After a photo is uploaded, ask the backend (OpenAI vision) whether it is a
  // clear photo of actual waste. Throws a user-facing message when it is not.
  // Fail-open: if the check could not run, it does not block the submission.
  // Returns an inline error message if the uploaded photo is not a clear image
  // of waste, or null to proceed. Fail-open: an unavailable check returns null.
  async function photoValidationMessage(photoUrl) {
    if (!photoUrl) return null
    let result
    try {
      result = await apiRequest('/pickuprequests/validate-photo', {
        method: 'POST',
        body: JSON.stringify({ photoUrl }),
      })
    } catch {
      return null // validation service unavailable -- do not block the submission
    }
    if (!result?.checked) return null
    if (!result.isClear) return 'The photo is not clear. Please upload a clearer photo of the waste.'
    if (!result.isWaste) return 'The photo is not waste. Please upload a photo of the waste to collect.'
    return null
  }

  async function handleCreate(e) {
    e.preventDefault()
    const errs = validatePickupForm(createForm, {
      requireZone: true,
      collectionDays,
      bulkRemaining: bulkAllowance?.remaining ?? null,
      hasPhoto: Boolean(createPhotoFile),
    })
    setCreateErrors(errs)
    if (Object.keys(errs).length > 0) return      // client-side gate

    setCreateFlowPhase('submitting')
    setError(null)
    try {
      let photoUrl
      if (createPhotoFile) {
        photoUrl = await uploadPickupPhoto(createPhotoFile)
        setCreateFlowPhase('checking-photo')
        const photoMsg = await photoValidationMessage(photoUrl)
        if (photoMsg) {
          setCreateErrors((prev) => ({ ...prev, photo: photoMsg }))
          return
        }
        setCreateFlowPhase('submitting')
      }
      const created = await apiRequest('/pickuprequests', {
        method: 'POST',
        body: JSON.stringify({
          description: createForm.description || undefined,
          ...(photoUrl ? { photoUrl } : {}),
          zoneId: createForm.zoneId,
          address: createForm.address.trim(),
          contactPhone: createForm.contactPhone.trim(),
          isBulkRequest: createForm.isBulkRequest,
          preferredDate: new Date(createForm.preferredDate).toISOString(),
          isRecurring: createForm.isRecurring,
          recurrenceInterval: createForm.isRecurring ? createForm.recurrenceInterval || undefined : undefined,
        }),
      })

      setCreateFlowPhase('classifying')
      const pipeline = await apiRequest(`/pickuprequests/${created.id}/run-agent-pipeline`, {
        method: 'POST',
      })

      const category = pipeline?.pickup?.category
      if (!pipeline?.success || !category) {
        throw new Error(pipeline?.message || 'Classification did not complete. You can try again from admin or resubmit.')
      }

      setSuccess(`Classified as ${category}.`)
      setCreateForm(emptyForm)
      setCreateErrors({})
      clearCreatePhoto()
      setShowForm(false)
      setPage(1)
      await Promise.all([load(), loadCounts(), loadBulkAllowance()])
    } catch (err) {
      const fieldErrors = mapBackendErrors(err.details)
      if (fieldErrors) setCreateErrors(fieldErrors)
      else setError(err.message)
      await load({ silent: true })
    } finally {
      setCreateFlowPhase(null)
    }
  }

  const createFormBusy = createFlowPhase !== null

  function startEdit(item) {
    setEditingId(item.id)
    setEditErrors({})
    clearEditPhotoSelection()
    setEditForm({
      ...emptyForm,
      description: item.description || '',
      photoUrl: item.photoUrl || '',
      preferredDate: toDateInputValue(item.preferredDate),
      isRecurring: item.isRecurring,
      recurrenceInterval: item.recurrenceInterval || '',
    })
  }

  async function handleUpdate(e) {
    e.preventDefault()
    const errs = validatePickupForm(editForm)
    setEditErrors(errs)
    if (Object.keys(errs).length > 0) return      // client-side gate

    const id = editingId
    setBusyId(id)
    setError(null)
    try {
      let photoUrl = editForm.photoUrl?.trim() || undefined
      if (editPhotoFile) {
        photoUrl = await uploadPickupPhoto(editPhotoFile)
        const photoMsg = await photoValidationMessage(photoUrl)
        if (photoMsg) {
          setEditErrors((prev) => ({ ...prev, photo: photoMsg }))
          return
        }
      }
      await apiRequest(`/pickuprequests/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          description: editForm.description || undefined,
          ...(photoUrl ? { photoUrl } : {}),
          preferredDate: new Date(editForm.preferredDate).toISOString(),
          isRecurring: editForm.isRecurring,
          recurrenceInterval: editForm.isRecurring ? editForm.recurrenceInterval || undefined : undefined,
        }),
      })
      setSuccess('Pickup request updated.')
      setEditErrors({})
      clearEditPhotoSelection()
      setEditingId(null)
      load()
    } catch (err) {
      const fieldErrors = mapBackendErrors(err.details)
      if (fieldErrors) setEditErrors(fieldErrors)
      else setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleCancel(id) {
    setBusyId(id)
    setError(null)
    try {
      await apiRequest(`/pickuprequests/${id}`, { method: 'DELETE' })
      setSuccess({ text: 'Pickup request cancelled.', tone: 'danger' })
      if (expandedId === id) setExpandedId(null)
      loadBulkAllowance()
      load()
      loadCounts()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / 20))

  return (
    <PageShell
      title="My pickups"
      description="Request a collection and follow what happens to it"
      showSearch
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by reference, item or address"
      actions={(
        <button
          type="button"
          className="ac-btn ac-btn-primary ac-btn-sm"
          onClick={() => setShowForm((open) => !open)}
          disabled={role !== 'resident' || createFormBusy}
          aria-expanded={showForm}
        >
          <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
          {showForm ? 'Hide form' : 'New pickup'}
        </button>
      )}
      filterBar={(
        <div className="ac-toolbar">
          <AcChips
            options={filterOptions}
            value={statusFilter}
            onChange={setStatusFilter}
            label="Filter pickups by status"
          />
          <span className="ac-toolbar-meta">
            {filteredItems.length} of {totalCount} requests
          </span>
        </div>
      )}
    >
      {role !== 'resident' && (
        <AcAlert message="Creating and editing pickups requires the resident role." />
      )}
      <AcAlert message={error} onClose={() => setError(null)} />

      {/* ---- New pickup ----
           Inline above the list rather than in a drawer or a centred panel.
           With a photo, the zone, the address, the date, a description, the
           bulky box and the recurrence, this form needs the full width of the
           page; in a 460px drawer and even in a 620px panel it could not be
           read without scrolling past most of it. */}
      {showForm && (
        <AcCard
          title="New pickup request"
          subtitle="Add a photo and the details, and we sort the rest"
          action={(
            <button
              type="button"
              className="ac-icon-btn"
              onClick={() => setShowForm(false)}
              disabled={createFormBusy}
              aria-label="Close the new pickup form"
            >
              <X size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        >
        <div className="r-pickup-form-wrap">
          {createFormBusy && (
            <div className="r-pickup-form-loading" role="status" aria-live="polite">
              <p>
                {createFlowPhase === 'checking-photo'
                  ? 'Checking your photo looks like waste…'
                  : createFlowPhase === 'submitting'
                  ? 'Uploading photo & saving your request…'
                  : 'Classifying your waste…'}
              </p>
            </div>
          )}
        <form className="ac-form" onSubmit={handleCreate} aria-busy={createFormBusy}>
          <PickupPhotoField
            previewUrl={createPhotoPreview}
            onFileChange={setCreatePhoto}
            onClear={clearCreatePhoto}
            disabled={createFormBusy || role !== 'resident'}
          />
          {createErrors.photoUrl && <p className="ac-field-error">{createErrors.photoUrl}</p>}
          {createErrors.photo && <p className="ac-field-error">{createErrors.photo}</p>}

          <div className="ac-field">
            <label htmlFor="pickup-zone">Your zone</label>
            <select
              id="pickup-zone"
              value={createForm.zoneId}
              onChange={(e) => {
                const zoneId = e.target.value
                const days = zones.find((z) => z.id === zoneId)?.collectionDays ?? []
                const picked = createForm.preferredDate
                  ? new Date(`${createForm.preferredDate}T00:00:00`)
                  : null
                // Drop a date the new zone is not collected on, so the calendar
                // never shows a selected day that is also greyed out.
                const keepDate = !picked
                  || days.length === 0
                  || days.includes(picked.getDay())
                setCreateForm({
                  ...createForm,
                  zoneId,
                  preferredDate: keepDate ? createForm.preferredDate : '',
                })
              }}
            >
              <option value="">Select your zone…</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>{zone.name}</option>
              ))}
            </select>
            {createErrors.zoneId && <p className="ac-field-error">{createErrors.zoneId}</p>}
            {/* Which days that zone is actually collected. Shown as soon as a
                zone is chosen, because the date below cannot be honoured on any
                other day and the form should not pretend otherwise. */}
            {collectionDaysLabel && <p className="ac-field-hint">{collectionDaysLabel}</p>}
          </div>

          {/* Side by side on a wide screen, stacked on a phone: together
              these two say how the crew reaches you on the day. */}
          <div className="ac-two">
            <div className="ac-field">
              <label htmlFor="pickup-address">Address</label>
              <input
                id="pickup-address"
                value={createForm.address}
                onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                placeholder="e.g. 14/2 Temple Road, near the junction"
              />
              {createErrors.address && <p className="ac-field-error">{createErrors.address}</p>}
              <p className="ac-field-hint">
                <MapPin size={12} strokeWidth={2.2} aria-hidden="true" />
                {' '}A zone is a whole suburb, so the crew needs the house number and street.
              </p>
            </div>

            <div className="ac-field">
              <label htmlFor="pickup-phone">Contact number</label>
              <input
                id="pickup-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={20}
                value={createForm.contactPhone}
                onChange={(e) => setCreateForm({ ...createForm, contactPhone: e.target.value })}
                placeholder="e.g. 0771234567"
              />
              {createErrors.contactPhone && <p className="ac-field-error">{createErrors.contactPhone}</p>}
              <p className="ac-field-hint">
                <Phone size={12} strokeWidth={2.2} aria-hidden="true" />
                {' '}Whoever will be at the collection &mdash; it need not be you.
              </p>
            </div>
          </div>

          <div className="ac-field">
            <label htmlFor="pickup-date">
              {collectionDays.length > 0 ? 'Choose a collection day' : 'Collect on or after'}
            </label>
            {/* The days the zone is not collected on are shown but greyed out,
                rather than the control offering only the few that are. A
                resident can then see that their zone is Mondays and Sundays,
                which a list of eight dates hides. */}
            <CollectionDayPicker
              id="pickup-date"
              value={createForm.preferredDate}
              onChange={(next) => setCreateForm({ ...createForm, preferredDate: next })}
              isDayOpen={collectionDays.length > 0
                ? (day) => collectionDays.includes(day.getDay())
                : undefined}
              maxDays={MAX_FUTURE_DAYS}
            />
            {createErrors.preferredDate && (
              <p className="ac-field-error">{createErrors.preferredDate}</p>
            )}
            {/* The hours are the same every day and nothing books a stop for
                a time of its own, so this is the only promise that can be
                made about when the crew arrives. */}
            <p className="ac-field-hint">
              Collections run {COLLECTION_WINDOW_LABEL}. Please have it out by
              the start of that window.
            </p>
          </div>

          <div className="ac-field">
            <label htmlFor="pickup-description">What needs collecting?</label>
            <textarea
              id="pickup-description"
              rows={3}
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              placeholder="Describe the waste to collect…"
            />
            {createErrors.description && (
              <p className="ac-field-error">{createErrors.description}</p>
            )}
          </div>

          <div className="r-bulk">
            <label className="r-bulk-check">
              <input
                type="checkbox"
                checked={createForm.isBulkRequest}
                onChange={(e) => setCreateForm({ ...createForm, isBulkRequest: e.target.checked })}
                disabled={bulkLocked}
              />
              <span className={bulkLocked ? 'is-off' : undefined}>
                This is a bulky-waste collection (furniture, mattress, large appliance)
              </span>
            </label>

            {bulkAllowance && (
              <p>
                {bulkAllowance.remaining > 0
                  ? `${bulkAllowance.remaining} of ${bulkAllowance.limit} bulky collections left this month.`
                  : `You have used all ${bulkAllowance.limit} bulky collections this month. The allowance resets on ${bulkResetLabel()}.`}
              </p>
            )}

            {createErrors.isBulkRequest && (
              <p className="ac-field-error">{createErrors.isBulkRequest}</p>
            )}

            {/* Nudged, never forced: the resident can still say no, and the
                classifier remains the backstop after submission. */}
            {!createForm.isBulkRequest && looksBulky(createForm.description) && (
              <p className="r-bulk-nudge">
                This looks like a bulky item. Bulky collections are booked separately and use
                your monthly allowance &mdash; tick the box above if that is what you need.
              </p>
            )}
          </div>

          <div className="ac-field">
            <label>How often?</label>
            <div className="r-toggle" role="group" aria-label="How often the pickup repeats">
              <button
                type="button"
                className={!createForm.isRecurring ? 'is-on' : undefined}
                aria-pressed={!createForm.isRecurring}
                onClick={() => setCreateForm({ ...createForm, isRecurring: false })}
              >
                One-off
              </button>
              <button
                type="button"
                className={createForm.isRecurring ? 'is-on' : undefined}
                aria-pressed={createForm.isRecurring}
                onClick={() => setCreateForm({ ...createForm, isRecurring: true })}
              >
                Recurring
              </button>
            </div>
          </div>

          {createForm.isRecurring && (
            <div className="ac-field">
              <label htmlFor="pickup-interval">How often does it repeat?</label>
              <select
                id="pickup-interval"
                value={createForm.recurrenceInterval}
                onChange={(e) => setCreateForm({ ...createForm, recurrenceInterval: e.target.value })}
              >
                <option value="">Select…</option>
                {/* A free text box here accepted anything and the server then
                    refused everything but these two. */}
                {ALLOWED_INTERVALS.map((interval) => (
                  <option key={interval} value={interval}>{interval}</option>
                ))}
              </select>
              {createErrors.recurrenceInterval && (
                <p className="ac-field-error">{createErrors.recurrenceInterval}</p>
              )}
            </div>
          )}

          <div className="ac-actions">
            <button
              type="submit"
              className="ac-btn ac-btn-primary"
              disabled={createFormBusy || role !== 'resident'}
            >
              <Send size={16} strokeWidth={2.2} aria-hidden="true" />
              Submit request
            </button>
            <button
              type="button"
              className="ac-btn ac-btn-ghost"
              onClick={() => setShowForm(false)}
              disabled={createFormBusy}
            >
              Cancel
            </button>
          </div>
        </form>
        </div>
        </AcCard>
      )}

      <AcCard>
        {loading ? (
          <p className="ac-loading">Loading your pickups…</p>
        ) : filteredItems.length === 0 ? (
          <p className="ac-empty">
            {search.trim() || statusFilter
              ? 'No requests match that.'
              : 'No pickup requests yet. Use “New pickup” to book your first one.'}
          </p>
        ) : (
          <div className="r-items">
            {filteredItems.map((item) => {
              const expanded = expandedId === item.id
              // Cancelling calls off a trip that is still going to happen.
              // A collected pickup has already had its trip, and a refused one
              // never got booked at all -- offering it there asked the resident
              // to cancel something that was not going ahead anyway, and the
              // backend refuses both.
              // Cancellation is only allowed within 30 minutes of creating the
              // request; after that the pickup is committed (the backend enforces
              // this too).
              const createdMs = new Date(item.createdAt).getTime()
              const withinCancelWindow = Number.isFinite(createdMs)
                && (Date.now() - createdMs) < 30 * 60 * 1000
              const canCancel = item.status !== 'Completed'
                && !isRefused(item)
                && item.lastAttemptStatus !== 'Completed'
                && withinCancelWindow

              return (
                <div className={`r-item${expanded ? ' is-open' : ''}`} key={item.id}>
                  <button
                    type="button"
                    className="r-item-head"
                    aria-expanded={expanded}
                    onClick={() => setExpandedId(expanded ? null : item.id)}
                  >
                    <span className="ac-ic">
                      <Package size={18} strokeWidth={2} aria-hidden="true" />
                    </span>
                    <span className="r-item-main">
                      <strong>{item.description || formatRequestId(item.id)}</strong>
                      <small>
                        {[formatRequestId(item.id), formatCompactDate(item.preferredDate), item.zoneName]
                          .filter(Boolean)
                          .join(' · ')}
                      </small>
                    </span>
                    {/* Only the real classification is shown. The keyword guess
                        that used to stand in here looked exactly like a decided
                        category, which is misleading now that Bulk draws down a
                        monthly allowance -- a resident could see "Bulk" and
                        reasonably believe a slot had been used when nothing had
                        been decided. */}
                    {item.category && (
                      <AcCategory category={item.category} confidence={item.confidence} />
                    )}
                    <AcStatusPill status={residentPickupStatusPillKey(item)} />
                    <ChevronRight className="r-item-chev" size={18} strokeWidth={2.2} aria-hidden="true" />
                  </button>

                  {expanded && (
                    <div className="r-item-body">
                      <ResidentApprovalNotice pickup={item} />

                      {/* What happened last time, in place of a notification.
                          The agent's wording when there is one, the crew's own
                          note when the agent could not be reached. */}
                      {item.lastAttemptStatus === 'Missed' && (
                        <div className="r-notice is-warn">
                          <strong>Not collected on {formatCompactDate(item.lastAttemptDate)}</strong>
                          <p>
                            {item.residentMessage
                              || item.lastAttemptNote
                              || 'The collection could not be made.'}
                          </p>
                          {item.nextVisitDate && (
                            <p className="r-notice-next">
                              Booked again for {formatCompactDate(item.nextVisitDate)}.
                            </p>
                          )}
                        </div>
                      )}

                      {/* A refused pickup. Separate from a missed one because
                          nothing is coming: there is no new date to offer, and
                          showing it as "not collected yet" would be a lie. */}
                      {isRefused(item) && (
                        <div className="r-notice is-bad">
                          <strong>This request was not approved</strong>
                          <p>
                            {item.residentMessage
                              || 'An admin reviewed this request and could not approve it.'}
                          </p>
                        </div>
                      )}

                      {/* An approved pickup carries the explanation the Notifier
                          wrote when it was flagged, which until now was shown
                          only to the admin and never to the person it was
                          written for. */}
                      {!isRefused(item)
                        && item.lastAttemptStatus !== 'Missed'
                        && item.residentMessage && (
                        <div className="r-notice is-info">
                          <p>{item.residentMessage}</p>
                        </div>
                      )}

                      <dl className="ac-kv">
                        <dt>Reference</dt>
                        <dd>{formatRequestId(item.id)}</dd>
                        {item.address && (
                          <>
                            <dt>Address</dt>
                            <dd>{item.address}</dd>
                          </>
                        )}
                        {/* Shown back so the resident can check the number the
                            crew will actually ring. */}
                        {item.contactPhone && (
                          <>
                            <dt>Contact</dt>
                            <dd>{item.contactPhone}</dd>
                          </>
                        )}
                        {item.zoneName && (
                          <>
                            <dt>Zone</dt>
                            <dd>{item.zoneName}</dd>
                          </>
                        )}
                        <dt>Collect on or after</dt>
                        <dd>{formatCompactDate(item.preferredDate)}</dd>
                        {item.nextVisitDate && (
                          <>
                            <dt>Next visit</dt>
                            <dd>
                              {formatCompactDate(item.nextVisitDate)}, {COLLECTION_WINDOW_LABEL}
                            </dd>
                          </>
                        )}
                        {item.isBulkRequest && (
                          <>
                            <dt>Type</dt>
                            <dd>Bulky collection</dd>
                          </>
                        )}
                        {item.isRecurring && (
                          <>
                            <dt>Repeats</dt>
                            <dd>{item.recurrenceInterval || 'Recurring'}</dd>
                          </>
                        )}
                        <dt>Requested</dt>
                        <dd>{formatCompactDate(item.createdAt)}</dd>
                      </dl>

                      {item.photoUrl && (
                        <a
                          className="r-photo"
                          href={item.photoUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img src={item.photoUrl} alt="Waste submitted for this pickup" />
                        </a>
                      )}

                      <div className="ac-actions">
                        {/* Editing is only open while nothing has been decided;
                            the backend refuses it after that. */}
                        {item.status === 'Pending' && (
                          <button
                            type="button"
                            className="ac-btn ac-btn-soft ac-btn-sm"
                            onClick={() => startEdit(item)}
                          >
                            Edit request
                          </button>
                        )}

                        {/* Only when the collection has genuinely not happened:
                            the crew reported it, or its day went by and nobody
                            closed it off. This used to show on anything not yet
                            collected, so a pickup booked for next Friday offered
                            a button the backend could only refuse -- the
                            resident had to click it to be told it was not due
                            yet. */}
                        {canAskAgain(item) && (
                          <button
                            type="button"
                            className="ac-btn ac-btn-soft ac-btn-sm"
                            disabled={busyId === item.id}
                            onClick={() => handleRequestAgain(item)}
                          >
                            <RotateCcw size={14} strokeWidth={2.2} aria-hidden="true" />
                            It wasn&rsquo;t collected &mdash; ask again
                          </button>
                        )}

                        {/* Cancelling stays available long after editing closes.
                            Pending lasts seconds, because the agents classify a
                            request on submission, and plans change after that --
                            a cancelled pickup is far better than a crew driving
                            out to an empty kerb. */}
                        {canCancel && (
                          <button
                            type="button"
                            className="ac-btn ac-btn-danger ac-btn-sm"
                            disabled={busyId === item.id}
                            onClick={() => setCancelId(item.id)}
                          >
                            <Trash2 size={14} strokeWidth={2.2} aria-hidden="true" />
                            Cancel this request
                          </button>
                        )}
                      </div>

                      {canCancel && (
                        <p className="ac-sub">
                          {item.isBulkRequest
                            ? 'Cancelling releases the booked visit and gives your bulky allowance back.'
                            : 'Cancelling releases the booked visit so the crew is not sent out for nothing.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="ac-pagination">
            <button
              type="button"
              className="ac-btn ac-btn-ghost ac-btn-sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              type="button"
              className="ac-btn ac-btn-ghost ac-btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        )}
      </AcCard>
      {/* ---- Edit a pending pickup ---- */}
      <AcModal
        open={Boolean(editingId)}
        onClose={() => setEditingId(null)}
        title="Edit your request"
      >
        {editingId && (
          <form className="ac-form" onSubmit={handleUpdate}>
            <p className="ac-sub">
              Only possible while nothing has been decided yet.
            </p>

            <PickupPhotoField
              existingUrl={editForm.photoUrl}
              previewUrl={editPhotoPreview}
              onFileChange={setEditPhoto}
              onClear={clearEditPhoto}
              disabled={busyId === editingId}
            />
            {editErrors.photo && <p className="ac-field-error">{editErrors.photo}</p>}

            <div className="ac-field">
              <label htmlFor="edit-date">Collect on or after</label>
              <input
                id="edit-date"
                type="date"
                value={editForm.preferredDate}
                onChange={(e) => setEditForm({ ...editForm, preferredDate: e.target.value })}
              />
              {editErrors.preferredDate && (
                <p className="ac-field-error">{editErrors.preferredDate}</p>
              )}
            </div>

            <div className="ac-field">
              <label htmlFor="edit-description">What needs collecting?</label>
              <textarea
                id="edit-description"
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
              {editErrors.description && (
                <p className="ac-field-error">{editErrors.description}</p>
              )}
            </div>

            <div className="ac-actions">
              <button
                type="submit"
                className="ac-btn ac-btn-primary"
                disabled={busyId === editingId}
              >
                <CalendarCheck size={16} strokeWidth={2.2} aria-hidden="true" />
                Save changes
              </button>
              <button
                type="button"
                className="ac-btn ac-btn-ghost"
                onClick={() => setEditingId(null)}
                disabled={busyId === editingId}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </AcModal>

      <AcModal
        open={cancelId !== null}
        onClose={() => setCancelId(null)}
        title="Cancel this pickup request?"
      >
        <div style={{ padding: '4px 20px 20px' }}>
          <p className="ac-sub" style={{ marginTop: 0 }}>
            This permanently deletes the request and releases the booked visit. This
            cannot be undone.
          </p>
          <div className="ac-actions" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="ac-btn ac-btn-ghost"
              onClick={() => setCancelId(null)}
              disabled={busyId === cancelId}
            >
              Keep request
            </button>
            <button
              type="button"
              className="ac-btn ac-btn-danger"
              disabled={busyId === cancelId}
              onClick={async () => {
                const id = cancelId
                await handleCancel(id)
                setCancelId(null)
              }}
            >
              {busyId === cancelId ? 'Cancelling…' : 'Cancel request'}
            </button>
          </div>
        </div>
      </AcModal>

      <AcToast message={success} onDone={() => setSuccess(null)} />
    </PageShell>
  )
}
