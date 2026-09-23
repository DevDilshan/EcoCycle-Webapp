import { useCallback, useEffect, useMemo, useState } from 'react'
import PageShell from '../../components/PageShell'
import AdminAlert from '../../components/admin/AdminAlert'
import AdminCard from '../../components/admin/AdminCard'
import ComplaintRowCard from '../../components/admin/ComplaintRowCard'
import { useAuth } from '../../context/AuthContext'
import { pickupLabel } from '../../lib/catalog'
import { apiRequest } from '../../lib/api'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [busy, setBusy] = useState(false)

  const pickupById = useMemo(
    () => new Map(pickups.map((pickup) => [pickup.id, pickup])),
    [pickups],
  )

  const counts = useMemo(() => ({
    open: complaints.filter((c) => c.status === 'Open').length,
    inReview: complaints.filter((c) => c.status === 'InProgress').length,
    resolved: complaints.filter((c) => c.status === 'Resolved').length,
  }), [complaints])

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

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const created = await apiRequest('/complaints', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      storeComplaintId(created.id)
      setSuccess('Complaint filed successfully.')
      setForm({ pickupRequestId: '', description: '' })
      setShowForm(false)
      await loadComplaints()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleLookup(e) {
    e.preventDefault()
    if (!lookupId.trim()) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const complaint = await apiRequest(`/complaints/${lookupId.trim()}`)
      storeComplaintId(complaint.id)
      setSuccess('Complaint loaded.')
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
      eyebrow={null}
      description={`${counts.open} open · track issues with your pickups`}
      actions={(
        <div className="admin-header-tabs">
          <span className="admin-header-tab header-tab-open">Open {counts.open}</span>
          <span className="admin-header-tab header-tab-review">In review {counts.inReview}</span>
          <span className="admin-header-tab header-tab-resolved">Resolved {counts.resolved}</span>
        </div>
      )}
    >
      {role !== 'resident' && (
        <AdminAlert type="error" message="Filing complaints requires the resident role." />
      )}
      <AdminAlert type="error" message={error} onClose={() => setError(null)} />
      <AdminAlert type="success" message={success} onClose={() => setSuccess(null)} />

      <button type="button" className="resident-cta-card resident-cta-card-button" onClick={() => setShowForm((v) => !v)}>
        <span className="resident-cta-icon">💬</span>
        <span className="resident-cta-text">
          <strong>File a complaint</strong>
          <small>Report a missed pickup, damage, or service issue</small>
        </span>
        <span className="resident-cta-arrow">›</span>
      </button>

      {showForm && (
        <AdminCard title="New complaint">
          <form className="admin-form" onSubmit={handleSubmit}>
            <div>
              <label>Related pickup</label>
              <select className="admin-select" value={form.pickupRequestId} onChange={(e) => setForm({ ...form, pickupRequestId: e.target.value })} required>
                <option value="">Select a pickup request…</option>
                {pickups.map((pickup) => (
                  <option key={pickup.id} value={pickup.id}>{pickupLabel(pickup)}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the issue with this pickup…" required />
            </div>
            <div className="admin-actions">
              <button type="submit" className="btn-primary btn-sm" disabled={busy || role !== 'resident'}>Submit complaint</button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </AdminCard>
      )}

      <AdminCard title="Look up by ID" subtitle="Paste a complaint reference if you have one">
        <form className="admin-form admin-form-inline" onSubmit={handleLookup}>
          <input value={lookupId} onChange={(e) => setLookupId(e.target.value)} placeholder="Complaint ID" />
          <button type="submit" className="btn-secondary btn-sm" disabled={busy}>Load</button>
        </form>
      </AdminCard>

      {loading ? (
        <p className="admin-loading">Loading complaints…</p>
      ) : complaints.length === 0 ? (
        <p className="admin-empty">No complaints tracked yet. File one above.</p>
      ) : (
        <div className="complaint-row-list">
          {complaints.map((item) => (
            <ComplaintRowCard
              key={item.id}
              complaint={item}
              residentLabel="You"
              zoneLabel="—"
              onView={() => {}}
            />
          ))}
        </div>
      )}
    </PageShell>
  )
}
