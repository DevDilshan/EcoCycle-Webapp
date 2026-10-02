import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import PageShell from '../../components/PageShell'
import AdminAlert from '../../components/admin/AdminAlert'
import AdminCard from '../../components/admin/AdminCard'
import CategoryPill from '../../components/admin/CategoryPill'
import FilterPills from '../../components/admin/FilterPills'
import PickupStatusPill from '../../components/admin/PickupStatusPill'
import { useAuth } from '../../context/AuthContext'
import {
  FILTER_PILL_STYLES,
  formatCompactDate,
  formatRequestId,
} from '../../lib/adminUi'
import { apiRequest } from '../../lib/api'
import { uploadPickupPhoto } from '../../lib/pickupPhoto'
import PickupPhotoField from '../../components/resident/PickupPhotoField'
import ResidentApprovalNotice from '../../components/resident/ResidentApprovalNotice'
import { residentPickupStatusPillKey } from '../../lib/residentPickupApproval'

const STATUS_FILTERS = ['', 'Pending', 'Classified', 'Scheduled', 'Completed', 'Rejected']

const emptyForm = {
  description: '',
  photoUrl: '',
  zoneId: '',
  address: '',
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
const fieldErrorStyle = { color: '#b42318', fontSize: '0.8rem', marginTop: '4px' }

function validatePickupForm(form, { requireZone = false } = {}) {
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
  }
  const desc = (form.description || '').trim()
  if (desc.length === 0) errors.description = 'Please describe the waste to be collected.'
  else if (desc.length < 5) errors.description = 'Description must be at least 5 characters.'
  else if (desc.length > 1000) errors.description = 'Description must be 1000 characters or fewer.'

  if (!form.preferredDate) {
    errors.preferredDate = 'Please choose a preferred date.'
  } else {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const picked = new Date(form.preferredDate); picked.setHours(0, 0, 0, 0)
    const max = new Date(today); max.setDate(max.getDate() + MAX_FUTURE_DAYS)
    if (Number.isNaN(picked.getTime())) errors.preferredDate = 'Please choose a valid date.'
    else if (picked < today) errors.preferredDate = 'Preferred date cannot be in the past.'
    else if (picked > max) errors.preferredDate = 'Preferred date must be within the next 12 months.'
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

// yyyy-mm-dd from a Date, built from local parts. toISOString() would convert
// to UTC first, which in UTC+5:30 turns an early-morning date into the day
// before and offers a day the zone is not collected on.
function toLocalDateValue(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
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
  if (item.status === 'Completed' || item.status === 'Rejected') return false
  if (item.lastAttemptStatus === 'Missed') return true
  if (item.lastAttemptStatus !== 'Pending' || !item.lastAttemptDate) return false

  const attempt = new Date(item.lastAttemptDate)
  if (Number.isNaN(attempt.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  attempt.setHours(0, 0, 0, 0)
  return attempt < today
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
  const [editForm, setEditForm] = useState(emptyForm)
  const [editPhotoFile, setEditPhotoFile] = useState(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState('')
  const [statusCheck, setStatusCheck] = useState(null)
  const [createErrors, setCreateErrors] = useState({})
  const [zones, setZones] = useState([])
  const [bulkAllowance, setBulkAllowance] = useState(null)

  // What the chosen zone's round actually is. The date below is a preference,
  // not a promise -- collection only happens on these days -- so saying so
  // stops the form asking a question it cannot honour.
  // The actual dates the chosen zone is collected on, for the next few weeks.
  // A free date box let a resident pick a Wednesday in a Tue/Fri zone and then
  // quietly ignored it; offering only real days means the answer can be kept.
  const collectionDates = useMemo(() => {
    const zone = zones.find((z) => z.id === createForm.zoneId)
    const days = zone?.collectionDays ?? []
    if (days.length === 0) return null

    const out = []
    const cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    for (let i = 1; i <= 28 && out.length < 8; i += 1) {
      const day = new Date(cursor)
      day.setDate(cursor.getDate() + i)
      if (days.includes(day.getDay())) out.push(day)
    }
    return out
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
  const [editErrors, setEditErrors] = useState({})

  function setCreatePhoto(file) {
    setCreatePhotoFile(file)
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

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: '20' })
      if (statusFilter) query.set('status', statusFilter)
      const data = await apiRequest(`/pickuprequests?${query}`)
      setItems(data.items)
      setTotalCount(data.totalCount)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => { loadCounts() }, [loadCounts])
  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [statusFilter, search])

  const filterOptions = useMemo(
    () => STATUS_FILTERS.filter((s) => s !== 'Rejected' || statusCounts.Rejected).map((status) => ({
      key: status,
      label: FILTER_PILL_STYLES[status]?.label || status,
      className: FILTER_PILL_STYLES[status]?.className || 'filter-pill-pending',
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
      return id.includes(q) || desc.includes(q)
    })
  }, [items, search])

  async function handleRequestAgain(item) {
    setBusyId(item.id)
    setError(null)
    setSuccess(null)
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

  async function handleCreate(e) {
    e.preventDefault()
    const errs = validatePickupForm(createForm, { requireZone: true })
    setCreateErrors(errs)
    if (Object.keys(errs).length > 0) return      // client-side gate

    setBusyId('create')
    setError(null)
    setSuccess(null)
    try {
      let photoUrl
      if (createPhotoFile) {
        photoUrl = await uploadPickupPhoto(createPhotoFile)
      }
      await apiRequest('/pickuprequests', {
        method: 'POST',
        body: JSON.stringify({
          description: createForm.description || undefined,
          ...(photoUrl ? { photoUrl } : {}),
          zoneId: createForm.zoneId,
          address: createForm.address.trim(),
          isBulkRequest: createForm.isBulkRequest,
          preferredDate: new Date(createForm.preferredDate).toISOString(),
          isRecurring: createForm.isRecurring,
          recurrenceInterval: createForm.isRecurring ? createForm.recurrenceInterval || undefined : undefined,
        }),
      })
      setSuccess('Pickup request submitted.')
      loadBulkAllowance()
      setCreateForm(emptyForm)
      setCreateErrors({})
      clearCreatePhoto()
      setShowForm(false)
      setPage(1)
      load()
      loadCounts()
    } catch (err) {
      const fieldErrors = mapBackendErrors(err.details)   // from api.js enhancement below
      if (fieldErrors) setCreateErrors(fieldErrors)
      else setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  function startEdit(item) {
    setExpandedId(item.id)
    clearEditPhotoSelection()
    setEditForm({
      description: item.description || '',
      photoUrl: item.photoUrl || '',
      preferredDate: toDateInputValue(item.preferredDate),
      isRecurring: item.isRecurring,
      recurrenceInterval: item.recurrenceInterval || '',
    })
  }

  async function handleUpdate(e, id) {
    e.preventDefault()
    const errs = validatePickupForm(editForm)
    setEditErrors(errs)
    if (Object.keys(errs).length > 0) return      // client-side gate

    setBusyId(id)
    setError(null)
    setSuccess(null)
    try {
      let photoUrl = editForm.photoUrl?.trim() || undefined
      if (editPhotoFile) {
        photoUrl = await uploadPickupPhoto(editPhotoFile)
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
      setEditForm((f) => ({ ...f, photoUrl: photoUrl || '' }))
      setEditErrors({})
      clearEditPhotoSelection()
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
    if (!window.confirm('Cancel this pickup request? The booked visit is released.')) return
    setBusyId(id)
    setError(null)
    setSuccess(null)
    try {
      await apiRequest(`/pickuprequests/${id}`, { method: 'DELETE' })
      setSuccess('Pickup request cancelled.')
      if (expandedId === id) setExpandedId(null)
      load()
      loadCounts()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleCheckStatus(id) {
    setBusyId(`status-${id}`)
    setError(null)
    try {
      const result = await apiRequest(`/pickuprequests/${id}`)
      setStatusCheck({ id, ...result })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / 20))

  return (
    <PageShell
      title="My pickup requests"
      eyebrow={null}
      description="Schedule waste pickups, track status, and manage pending requests."
      showSearch
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by ID or description…"
      actions={(
        <button type="button" className="btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
          + New pickup
        </button>
      )}
      filterBar={(
        <FilterPills options={filterOptions} value={statusFilter} onChange={setStatusFilter} />
      )}
    >
      {role !== 'resident' && (
        <AdminAlert type="error" message="Creating and editing pickups requires the resident role." />
      )}
      <AdminAlert type="error" message={error} onClose={() => setError(null)} />
      <AdminAlert type="success" message={success} onClose={() => setSuccess(null)} />

      {showForm && (
        <AdminCard title="New pickup request" subtitle="Snap a photo and describe your waste">
          <form className="admin-form" onSubmit={handleCreate}>
            <PickupPhotoField
              previewUrl={createPhotoPreview}
              onFileChange={setCreatePhoto}
              onClear={clearCreatePhoto}
              disabled={busyId === 'create' || role !== 'resident'}
            />
            <div className="admin-form-row">
              <div>
                <label htmlFor="pickup-zone">Zone</label>
                <select
                  id="pickup-zone"
                  value={createForm.zoneId}
                  onChange={(e) => setCreateForm({ ...createForm, zoneId: e.target.value })}
                >
                  <option value="">Select your zone…</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>{zone.name}</option>
                  ))}
                </select>
                {createErrors.zoneId && <p style={fieldErrorStyle}>{createErrors.zoneId}</p>}

                {/* Which days that zone is actually collected. Shown as soon as
                    a zone is chosen, because the date below cannot be honoured
                    on any other day and the form should not pretend otherwise. */}
                {collectionDaysLabel && (
                  <p className="resident-zone-days">{collectionDaysLabel}</p>
                )}
              </div>
              <div>
                <label htmlFor="pickup-address">Address</label>
                <input
                  id="pickup-address"
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  placeholder="e.g. 14/2 Temple Road, near the junction"
                />
                {createErrors.address && <p style={fieldErrorStyle}>{createErrors.address}</p>}
              </div>
              <div>
                <label htmlFor="pickup-date">
                  {collectionDates ? 'Choose a collection day' : 'Collect on or after'}
                </label>
                {collectionDates ? (
                  <select
                    id="pickup-date"
                    value={createForm.preferredDate}
                    onChange={(e) => setCreateForm({ ...createForm, preferredDate: e.target.value })}
                  >
                    <option value="">Select a day…</option>
                    {collectionDates.map((day) => {
                      const value = toLocalDateValue(day)
                      return (
                        <option key={value} value={value}>
                          {day.toLocaleDateString(undefined, {
                            weekday: 'long', day: 'numeric', month: 'long',
                          })}
                        </option>
                      )
                    })}
                  </select>
                ) : (
                  <input
                    id="pickup-date"
                    type="date"
                    value={createForm.preferredDate}
                    onChange={(e) => setCreateForm({ ...createForm, preferredDate: e.target.value })}
                  />
                )}
                {createErrors.preferredDate && <p style={fieldErrorStyle}>{createErrors.preferredDate}</p>}
              </div>
            </div>
            <div>
              <label>Description</label>
              <textarea value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} placeholder="Describe the waste to collect…" />
              {createErrors.description && <p style={fieldErrorStyle}>{createErrors.description}</p>}
            </div>

            <div className="resident-bulk-box">
              <label className="resident-bulk-check">
                <input
                  type="checkbox"
                  checked={createForm.isBulkRequest}
                  onChange={(e) => setCreateForm({ ...createForm, isBulkRequest: e.target.checked })}
                  disabled={bulkAllowance?.remaining === 0 && !createForm.isBulkRequest}
                />
                <span>This is a bulky-waste collection (furniture, mattress, large appliance)</span>
              </label>

              {bulkAllowance && (
                <p className="resident-bulk-note">
                  {bulkAllowance.remaining > 0
                    ? `${bulkAllowance.remaining} of ${bulkAllowance.limit} bulky collections left this month.`
                    : `You have used all ${bulkAllowance.limit} bulky collections this month. The allowance resets on the 1st.`}
                </p>
              )}

              {/* Nudged, never forced: the resident can still say no, and the
                  classifier remains the backstop after submission. */}
              {!createForm.isBulkRequest && looksBulky(createForm.description) && (
                <p className="resident-bulk-nudge">
                  This looks like a bulky item. Bulky collections are booked separately and use
                  your monthly allowance — tick the box above if that is what you need.
                </p>
              )}
            </div>

            <div className="resident-type-toggle">
              <button type="button" className={`resident-type-btn${!createForm.isRecurring ? ' active' : ''}`} onClick={() => setCreateForm({ ...createForm, isRecurring: false })}>One-off</button>
              <button type="button" className={`resident-type-btn${createForm.isRecurring ? ' active' : ''}`} onClick={() => setCreateForm({ ...createForm, isRecurring: true })}>Recurring</button>
            </div>
            {createForm.isRecurring && (
              <div>
                <label>Recurrence interval</label>
                <input value={createForm.recurrenceInterval} onChange={(e) => setCreateForm({ ...createForm, recurrenceInterval: e.target.value })} placeholder="e.g. weekly" />
                {createErrors.recurrenceInterval && <p style={fieldErrorStyle}>{createErrors.recurrenceInterval}</p>}
              </div>
            )}
            <div className="admin-actions">
              <button type="submit" className="btn-primary btn-sm" disabled={busyId === 'create' || role !== 'resident'}>Submit request</button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </AdminCard>
      )}

      {loading ? (
        <p className="admin-loading">Loading pickups…</p>
      ) : filteredItems.length === 0 ? (
        <p className="admin-empty">No pickup requests yet.</p>
      ) : (
        <div className="pickup-grid-table">
          <div className="pickup-grid-header">
            <span>ID</span>
            <span>Item</span>
            <span>Category</span>
            <span>Preferred</span>
            <span>Status</span>
            <span />
          </div>
          {filteredItems.map((item) => {
            // Only the real classification is shown. The keyword guess that used to stand
            // in here looked exactly like a decided category, which is misleading now that
            // Bulk draws down a monthly allowance -- a resident could see "Bulk" and
            // reasonably believe a slot had been used when nothing had been decided.
            const category = item.category
            const expanded = expandedId === item.id
            const statusPillKey = residentPickupStatusPillKey(item)
            return (
              <Fragment key={item.id}>
                <button
                  type="button"
                  className="pickup-grid-row"
                  onClick={() => {
                    if (expanded) {
                      setExpandedId(null)
                      return
                    }
                    startEdit(item)
                    setExpandedId(item.id)
                  }}
                >
                  <span className="pickup-grid-id">{formatRequestId(item.id)}</span>
                  <span className="pickup-grid-resident">
                    <strong>{item.description?.slice(0, 48) || 'Pickup request'}</strong>
                    <small>{formatCompactDate(item.createdAt)}</small>
                  </span>
                  <span>
                    {category
                      ? <CategoryPill category={category} />
                      : <span className="resident-awaiting">Being sorted…</span>}
                  </span>
                  <span className="pickup-grid-muted">{formatCompactDate(item.preferredDate)}</span>
                  <span><PickupStatusPill status={statusPillKey} /></span>
                  <span className="pickup-grid-muted">›</span>
                </button>
                {expanded && (
                  <div className="pickup-grid-detail">
                    <ResidentApprovalNotice pickup={item} />

                    {/* What happened last time, in place of a notification. The
                        agent's wording when there is one, the crew's own note
                        when the agent could not be reached. */}
                    {item.lastAttemptStatus === 'Missed' && (
                      <div className="resident-missed">
                        <strong>Not collected on {formatCompactDate(item.lastAttemptDate)}</strong>
                        <p>{item.residentMessage || item.lastAttemptNote || 'The collection could not be made.'}</p>
                        {item.nextVisitDate && (
                          <p className="resident-missed-next">
                            Booked again for {formatCompactDate(item.nextVisitDate)}.
                          </p>
                        )}
                      </div>
                    )}

                    {/* A refused pickup. Separate from a missed one because
                        nothing is coming: there is no new date to offer, and
                        showing it as "not collected yet" would be a lie. */}
                    {item.status === 'Rejected' && (
                      <div className="resident-rejected">
                        <strong>This request was not approved</strong>
                        <p>{item.residentMessage || 'An admin reviewed this request and could not approve it.'}</p>
                      </div>
                    )}

                    {/* An approved pickup carries the explanation the Notifier
                        wrote when it was flagged, which until now was shown only
                        to the admin and never to the person it was written for. */}
                    {item.status !== 'Rejected'
                      && item.lastAttemptStatus !== 'Missed'
                      && item.residentMessage && (
                      <div className="resident-note">
                        <p>{item.residentMessage}</p>
                      </div>
                    )}

                    {item.address && (
                      <p><strong>Address:</strong> {item.address}</p>
                    )}

                    {/* Only when the collection has genuinely not happened:
                        the crew reported it, or its day went by and nobody closed
                        it off. This used to show on anything not yet collected,
                        so a pickup booked for next Friday offered a button the
                        backend could only refuse -- the resident had to click it
                        to be told it was not due yet. */}
                    {canAskAgain(item) && (
                      <div className="resident-again">
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          disabled={busyId === item.id}
                          onClick={() => handleRequestAgain(item)}
                        >
                          It wasn&rsquo;t collected — ask again
                        </button>
                      </div>
                    )}

                    {/* Cancelling is kept out of the edit form below, which only
                        appears while a request is Pending -- a state that lasts
                        seconds, because the agents classify it on submission.
                        Plans change after that, and a cancelled pickup is far
                        better than a crew driving out to an empty kerb. */}
                    {item.status !== 'Completed' && item.lastAttemptStatus !== 'Completed' && (
                      <div className="resident-again">
                        <button
                          type="button"
                          className="btn-danger btn-sm"
                          disabled={busyId === item.id}
                          onClick={() => handleCancel(item.id)}
                        >
                          Cancel this request
                        </button>
                        <p className="pickup-grid-muted">
                          {item.isBulkRequest
                            ? 'The booked visit is released and your bulky allowance is given back.'
                            : 'The booked visit is released so the crew is not sent out for nothing.'}
                        </p>
                      </div>
                    )}
                    {item.photoUrl && item.status !== 'Pending' && (
                      <div className="resident-pickup-photo-detail">
                        <strong>Waste photo</strong>
                        <a href={item.photoUrl} target="_blank" rel="noreferrer">
                          <img src={item.photoUrl} alt="Waste submitted for pickup" />
                        </a>
                      </div>
                    )}
                    {statusCheck?.id === item.id && (
                      <p><strong>Live status:</strong> <PickupStatusPill status={residentPickupStatusPillKey(statusCheck)} /></p>
                    )}
                    <div className="admin-actions">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => handleCheckStatus(item.id)} disabled={busyId === `status-${item.id}`}>Check status</button>
                    </div>
                    {item.status === 'Pending' && (
                      <form className="admin-form" onSubmit={(e) => handleUpdate(e, item.id)} style={{ marginTop: '1rem' }}>
                        <p style={{ margin: '0 0 0.5rem', fontWeight: 700 }}>Edit pending request</p>
                        <PickupPhotoField
                          existingUrl={editForm.photoUrl}
                          previewUrl={editPhotoPreview}
                          onFileChange={setEditPhoto}
                          onClear={clearEditPhoto}
                          disabled={busyId === item.id}
                        />
                        <div className="admin-form-row">
                          <div>
                            <label>Preferred date</label>
                            <input type="date" value={editForm.preferredDate} onChange={(e) => setEditForm({ ...editForm, preferredDate: e.target.value })} />
                            {editErrors.preferredDate && <p style={fieldErrorStyle}>{editErrors.preferredDate}</p>}
                          </div>
                        </div>
                        <div>
                          <label>Description</label>
                          <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                          {editErrors.description && <p style={fieldErrorStyle}>{editErrors.description}</p>}
                        </div>
                        <div className="admin-actions">
                          <button type="button" className="btn-secondary btn-sm" onClick={() => startEdit(item)}>Reset</button>
                          <button type="submit" className="btn-primary btn-sm" disabled={busyId === item.id}>Save</button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </Fragment>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="admin-pagination">
          <button type="button" className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="admin-pagination-meta">Page {page} of {totalPages}</span>
          <button type="button" className="btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </PageShell>
  )
}
