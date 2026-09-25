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
  inferCategory,
} from '../../lib/adminUi'
import { apiRequest } from '../../lib/api'

const STATUS_FILTERS = ['', 'Pending', 'Classified', 'Scheduled', 'Completed', 'Rejected']

const emptyForm = {
  description: '',
  photoUrl: '',
  preferredDate: '',
  isRecurring: false,
  recurrenceInterval: '',
}

function toDateInputValue(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
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
  const [editForm, setEditForm] = useState(emptyForm)
  const [statusCheck, setStatusCheck] = useState(null)

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

  async function handleCreate(e) {
    e.preventDefault()
    setBusyId('create')
    setError(null)
    setSuccess(null)
    try {
      await apiRequest('/pickuprequests', {
        method: 'POST',
        body: JSON.stringify({
          description: createForm.description || undefined,
          photoUrl: createForm.photoUrl || undefined,
          preferredDate: new Date(createForm.preferredDate).toISOString(),
          isRecurring: createForm.isRecurring,
          recurrenceInterval: createForm.isRecurring ? createForm.recurrenceInterval || undefined : undefined,
        }),
      })
      setSuccess('Pickup request submitted.')
      setCreateForm(emptyForm)
      setShowForm(false)
      setPage(1)
      load()
      loadCounts()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  function startEdit(item) {
    setExpandedId(item.id)
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
    setBusyId(id)
    setError(null)
    setSuccess(null)
    try {
      await apiRequest(`/pickuprequests/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          description: editForm.description || undefined,
          photoUrl: editForm.photoUrl || undefined,
          preferredDate: new Date(editForm.preferredDate).toISOString(),
          isRecurring: editForm.isRecurring,
          recurrenceInterval: editForm.isRecurring ? editForm.recurrenceInterval || undefined : undefined,
        }),
      })
      setSuccess('Pickup request updated.')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleCancel(id) {
    if (!window.confirm('Cancel this pickup request?')) return
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
      const result = await apiRequest(`/pickuprequests/${id}/status`)
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
            <div className="resident-photo-dropzone">
              <span className="resident-photo-icon">📷</span>
              <strong>Take a photo of the waste</strong>
              <small>or paste a photo URL below</small>
            </div>
            <div className="admin-form-row">
              <div>
                <label>Preferred date</label>
                <input type="date" value={createForm.preferredDate} onChange={(e) => setCreateForm({ ...createForm, preferredDate: e.target.value })} required />
              </div>
              <div>
                <label>Photo URL (optional)</label>
                <input value={createForm.photoUrl} onChange={(e) => setCreateForm({ ...createForm, photoUrl: e.target.value })} placeholder="https://…" />
              </div>
            </div>
            <div>
              <label>Description</label>
              <textarea value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} placeholder="Describe the waste to collect…" />
            </div>
            <div className="resident-type-toggle">
              <button type="button" className={`resident-type-btn${!createForm.isRecurring ? ' active' : ''}`} onClick={() => setCreateForm({ ...createForm, isRecurring: false })}>One-off</button>
              <button type="button" className={`resident-type-btn${createForm.isRecurring ? ' active' : ''}`} onClick={() => setCreateForm({ ...createForm, isRecurring: true })}>Recurring</button>
            </div>
            {createForm.isRecurring && (
              <div>
                <label>Recurrence interval</label>
                <input value={createForm.recurrenceInterval} onChange={(e) => setCreateForm({ ...createForm, recurrenceInterval: e.target.value })} placeholder="e.g. weekly" />
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
            const category = inferCategory(item.description)
            const expanded = expandedId === item.id
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
                  <span><CategoryPill category={category} /></span>
                  <span className="pickup-grid-muted">{formatCompactDate(item.preferredDate)}</span>
                  <span><PickupStatusPill status={item.status} /></span>
                  <span className="pickup-grid-muted">›</span>
                </button>
                {expanded && (
                  <div className="pickup-grid-detail">
                    {item.photoUrl && <p><strong>Photo:</strong> <a href={item.photoUrl} target="_blank" rel="noreferrer">View</a></p>}
                    {statusCheck?.id === item.id && (
                      <p><strong>Live status:</strong> <PickupStatusPill status={statusCheck.status} /></p>
                    )}
                    <div className="admin-actions">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => handleCheckStatus(item.id)} disabled={busyId === `status-${item.id}`}>Check status</button>
                    </div>
                    {item.status === 'Pending' && (
                      <form className="admin-form" onSubmit={(e) => handleUpdate(e, item.id)} style={{ marginTop: '1rem' }}>
                        <p style={{ margin: '0 0 0.5rem', fontWeight: 700 }}>Edit pending request</p>
                        <div className="admin-form-row">
                          <div>
                            <label>Preferred date</label>
                            <input type="date" value={editForm.preferredDate} onChange={(e) => setEditForm({ ...editForm, preferredDate: e.target.value })} required />
                          </div>
                          <div>
                            <label>Photo URL</label>
                            <input value={editForm.photoUrl} onChange={(e) => setEditForm({ ...editForm, photoUrl: e.target.value })} />
                          </div>
                        </div>
                        <div>
                          <label>Description</label>
                          <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                        </div>
                        <div className="admin-actions">
                          <button type="button" className="btn-secondary btn-sm" onClick={() => startEdit(item)}>Reset</button>
                          <button type="submit" className="btn-primary btn-sm" disabled={busyId === item.id}>Save</button>
                          <button type="button" className="btn-danger btn-sm" onClick={() => handleCancel(item.id)} disabled={busyId === item.id}>Cancel request</button>
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
