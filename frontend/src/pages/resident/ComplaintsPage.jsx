import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessageSquare, Plus, Search } from 'lucide-react'
import PageShell from '../../components/admin/AdminPageShell'
import { AcAlert, AcCard, AcChips, AcModal, AcToast } from '../../components/admin/AcUi'
import ResidentComplaintList from '../../components/resident/ResidentComplaintList'
import { useAuth } from '../../context/AuthContext'
import { resolveComplaintLookupId } from '../../lib/complaintLookup'
import { pickupLabel } from '../../lib/catalog'
import { apiRequest } from '../../lib/api'
import {
  COMPLAINT_DESCRIPTION_MAX,
  COMPLAINT_DESCRIPTION_MIN,
  mapComplaintBackendErrors,
  validateComplaintForm,
} from '../../lib/residentComplaint'

const STORAGE_KEY = 'ecocycle-resident-complaints'

function loadStoredIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function storeComplaintId(id) {
  const ids = loadStoredIds()
  if (!ids.includes(id)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([id, ...ids]))
  }
}

export default function ResidentComplaintsPage() {
  const { role } = useAuth()
  const [pickups, setPickups] = useState([])
  const [complaints, setComplaints] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [lookupId, setLookupId] = useState('')
  const [form, setForm] = useState({ pickupRequestId: '', description: '' })
  const [formErrors, setFormErrors] = useState({})
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [busy, setBusy] = useState(false)

  const pickupById = useMemo(
    () => new Map(pickups.map((pickup) => [pickup.id, pickup])),
    [pickups],
  )

  const counts = useMemo(() => ({
    total: complaints.length,
    open: complaints.filter((c) => c.status === 'Open').length,
    inReview: complaints.filter((c) => c.status === 'InProgress').length,
    resolved: complaints.filter((c) => c.status === 'Resolved').length,
  }), [complaints])

  // The counts were only ever readable as three static labels in the header.
  // As chips they do the same job and also filter, which is what someone
  // clicking "Open 2" expects to happen.
  const filters = [
    { key: '', label: 'All', count: counts.total },
    { key: 'Open', label: 'Open', count: counts.open },
    { key: 'InProgress', label: 'In review', count: counts.inReview },
    { key: 'Resolved', label: 'Resolved', count: counts.resolved },
  ]

  const visible = useMemo(
    () => (filter ? complaints.filter((c) => c.status === filter) : complaints),
    [complaints, filter],
  )

  const loadComplaints = useCallback(async () => {
    const ids = loadStoredIds()
    if (ids.length === 0) {
      setComplaints([])
      return
    }
    const results = await Promise.allSettled(
      ids.map((id) => apiRequest(`/complaints/${id}`)),
    )
    setComplaints(
      results.filter((r) => r.status === 'fulfilled').map((r) => r.value),
    )
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const pickupData = await apiRequest('/pickuprequests?pageSize=100')
      setPickups(pickupData.items ?? [])
      await loadComplaints()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [loadComplaints])

  useEffect(() => { load() }, [load])

  function openComplaintForm() {
    setFormErrors({})
    setError(null)
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validateComplaintForm(form, { pickups, complaints })
    setFormErrors(errs)
    if (Object.keys(errs).length > 0) return

    setBusy(true)
    setError(null)
    try {
      const created = await apiRequest('/complaints', {
        method: 'POST',
        body: JSON.stringify({
          pickupRequestId: form.pickupRequestId,
          description: form.description.trim(),
        }),
      })
      storeComplaintId(created.id)
      setSuccess('Complaint filed. Support will pick it up from here.')
      setForm({ pickupRequestId: '', description: '' })
      setFormErrors({})
      setShowForm(false)
      await loadComplaints()
    } catch (err) {
      const fieldErrors = mapComplaintBackendErrors(err.details)
      if (fieldErrors) setFormErrors(fieldErrors)
      else setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleLookup(e) {
    e.preventDefault()
    if (!lookupId.trim()) return
    setBusy(true)
    setError(null)
    try {
      const id = resolveComplaintLookupId(lookupId, complaints)
      if (!id) {
        setError('That does not look like a complaint reference. Try CMP-4490 or the full ID.')
        return
      }
      const complaint = await apiRequest(`/complaints/${id}`)
      storeComplaintId(complaint.id)
      setSuccess('Complaint added to your list.')
      await loadComplaints()
      setLookupId('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell
      title="Complaints"
      description="Issues you have raised about a pickup"
      actions={(
        <button
          type="button"
          className="ac-btn ac-btn-primary ac-btn-sm"
          onClick={openComplaintForm}
          disabled={role !== 'resident'}
        >
          <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
          File a complaint
        </button>
      )}
      filterBar={complaints.length > 0 ? (
        <div className="ac-toolbar">
          <AcChips options={filters} value={filter} onChange={setFilter} label="Filter complaints by status" />
          <span className="ac-toolbar-meta">{visible.length} of {counts.total}</span>
        </div>
      ) : null}
    >
      {role !== 'resident' && (
        <AcAlert message="Filing complaints requires the resident role." />
      )}
      <AcAlert message={error} onClose={() => setError(null)} />

      {loading ? (
        <p className="ac-loading">Loading complaints…</p>
      ) : (
        <>
          <AcCard
            title="Your complaints"
            subtitle="Kept on this device, so a reference from elsewhere needs adding below"
          >
            {complaints.length === 0 ? (
              <p className="ac-empty">
                Nothing raised yet. File one above, or add a reference you were given.
              </p>
            ) : visible.length === 0 ? (
              <p className="ac-empty">No complaints match that filter.</p>
            ) : (
              <ResidentComplaintList complaints={visible} pickupById={pickupById} />
            )}
          </AcCard>

          <AcCard
            title="Track another complaint"
            subtitle="Paste the reference from your confirmation, or the full ID"
          >
            <form className="ac-form" onSubmit={handleLookup}>
              <div className="ac-field">
                <label htmlFor="complaint-lookup">Complaint reference</label>
                <input
                  id="complaint-lookup"
                  value={lookupId}
                  onChange={(e) => setLookupId(e.target.value)}
                  placeholder="CMP-4490 or the full ID"
                />
              </div>
              <div className="ac-actions">
                <button
                  type="submit"
                  className="ac-btn ac-btn-primary"
                  disabled={busy || !lookupId.trim()}
                >
                  <Search size={15} strokeWidth={2.2} aria-hidden="true" />
                  Add to my list
                </button>
              </div>
            </form>
          </AcCard>
        </>
      )}

      <AcModal
        open={showForm}
        onClose={() => { setShowForm(false); setFormErrors({}) }}
        title="File a complaint"
      >
        <p className="ac-sub">
          Report a missed pickup, damage, or anything else that went wrong.
        </p>
        <form className="ac-form" onSubmit={handleSubmit}>
          <div className="ac-field">
            <label htmlFor="complaint-pickup">Which pickup is it about?</label>
            <select
              id="complaint-pickup"
              value={form.pickupRequestId}
              onChange={(e) => {
                setForm({ ...form, pickupRequestId: e.target.value })
                setFormErrors((prev) => {
                  const next = { ...prev }
                  delete next.pickupRequestId
                  return next
                })
              }}
              aria-invalid={Boolean(formErrors.pickupRequestId)}
              aria-describedby={formErrors.pickupRequestId ? 'complaint-pickup-error' : undefined}
            >
              <option value="">Select a pickup request…</option>
              {pickups.map((pickup) => (
                <option key={pickup.id} value={pickup.id}>{pickupLabel(pickup)}</option>
              ))}
            </select>
            {pickups.length === 0 && (
              <p className="ac-field-hint">You need at least one pickup request before filing a complaint.</p>
            )}
            {formErrors.pickupRequestId && (
              <p id="complaint-pickup-error" className="ac-field-error" role="alert">
                {formErrors.pickupRequestId}
              </p>
            )}
          </div>
          <div className="ac-field">
            <label htmlFor="complaint-description">What happened?</label>
            <textarea
              id="complaint-description"
              rows={4}
              value={form.description}
              maxLength={COMPLAINT_DESCRIPTION_MAX}
              onChange={(e) => {
                setForm({ ...form, description: e.target.value })
                setFormErrors((prev) => {
                  const next = { ...prev }
                  delete next.description
                  return next
                })
              }}
              placeholder="Describe the issue with this pickup…"
              aria-invalid={Boolean(formErrors.description)}
              aria-describedby="complaint-description-hint complaint-description-error"
            />
            <p id="complaint-description-hint" className="ac-field-hint">
              {COMPLAINT_DESCRIPTION_MIN}–{COMPLAINT_DESCRIPTION_MAX} characters (
              {form.description.trim().length}/{COMPLAINT_DESCRIPTION_MAX})
            </p>
            {formErrors.description && (
              <p id="complaint-description-error" className="ac-field-error" role="alert">
                {formErrors.description}
              </p>
            )}
          </div>
          <div className="ac-actions">
            <button
              type="submit"
              className="ac-btn ac-btn-primary"
              disabled={busy || role !== 'resident' || pickups.length === 0}
            >
              <MessageSquare size={16} strokeWidth={2.2} aria-hidden="true" />
              Submit complaint
            </button>
            <button
              type="button"
              className="ac-btn ac-btn-ghost"
              onClick={() => setShowForm(false)}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </form>
      </AcModal>

      <AcToast message={success} onDone={() => setSuccess(null)} />
    </PageShell>
  )
}
