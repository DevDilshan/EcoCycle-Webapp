import { useCallback, useEffect, useMemo, useState } from 'react'
import PageShell from '../../components/PageShell'
import AdminAlert from '../../components/admin/AdminAlert'
import AdminCard from '../../components/admin/AdminCard'
import ComplaintRowCard from '../../components/admin/ComplaintRowCard'
import { useAdminCatalog } from '../../hooks/useAdminCatalog'
import { apiRequest } from '../../lib/api'

const STATUS_TABS = [
  { key: 'Open', label: 'Open', className: 'header-tab-open' },
  { key: 'InProgress', label: 'In review', className: 'header-tab-review' },
  { key: 'Resolved', label: 'Resolved', className: 'header-tab-resolved' },
]

export default function ComplaintsPage() {
  const catalog = useAdminCatalog()
  const [items, setItems] = useState([])
  const [counts, setCounts] = useState({ Open: 0, InProgress: 0, Resolved: 0, total: 0 })
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ status: 'Resolved', adminNotes: '' })
  const [busy, setBusy] = useState(false)

  const loadCounts = useCallback(async () => {
    const [total, open, inProgress, resolved] = await Promise.all([
      apiRequest('/complaints?pageSize=1'),
      apiRequest('/complaints?status=Open&pageSize=1'),
      apiRequest('/complaints?status=InProgress&pageSize=1'),
      apiRequest('/complaints?status=Resolved&pageSize=1'),
    ])
    setCounts({
      total: total.totalCount,
      Open: open.totalCount,
      InProgress: inProgress.totalCount,
      Resolved: resolved.totalCount,
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({ pageSize: '20' })
      if (statusFilter) query.set('status', statusFilter)
      const data = await apiRequest(`/complaints?${query}`)
      setItems(data.items)
      await loadCounts()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, loadCounts])

  useEffect(() => { load() }, [load])

  const resolvedRate = counts.total
    ? Math.round((counts.Resolved / counts.total) * 100)
    : 0

  const headerTabs = useMemo(
    () => STATUS_TABS.map((tab) => ({
      ...tab,
      count: counts[tab.key],
    })),
    [counts],
  )

  async function handleResolve(complaint) {
    setEditingId(complaint.id)
    setEditForm({ status: 'Resolved', adminNotes: complaint.adminNotes || '' })
  }

  async function handleUpdate(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await apiRequest(`/complaints/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      })
      setSuccess('Complaint updated.')
      setEditingId(null)
      load()
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
      description={`${counts.Open} open · ${resolvedRate}% resolved this month`}
      actions={(
        <div className="admin-header-tabs">
          {headerTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`admin-header-tab ${tab.className}${statusFilter === tab.key ? ' admin-header-tab-active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === tab.key ? '' : tab.key)}
            >
              {tab.label}{tab.count != null ? ` ${tab.count}` : ''}
            </button>
          ))}
        </div>
      )}
    >
      <AdminAlert type="error" message={error || catalog.error} onClose={() => setError(null)} />
      <AdminAlert type="success" message={success} onClose={() => setSuccess(null)} />

      {editingId && (
        <AdminCard title="Resolve complaint">
          <form className="admin-form" onSubmit={handleUpdate}>
            <div>
              <label>Status</label>
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                <option value="Open">Open</option>
                <option value="InProgress">In review</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>
            <div>
              <label>Admin notes</label>
              <textarea value={editForm.adminNotes} onChange={(e) => setEditForm({ ...editForm, adminNotes: e.target.value })} />
            </div>
            <div className="admin-actions">
              <button type="submit" className="btn-primary btn-sm" disabled={busy}>Save</button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
            </div>
          </form>
        </AdminCard>
      )}

      {loading ? (
        <p className="admin-loading">Loading complaints…</p>
      ) : items.length === 0 ? (
        <p className="admin-empty">No complaints found.</p>
      ) : (
        <div className="complaint-row-list">
          {items.map((item) => (
            <ComplaintRowCard
              key={item.id}
              complaint={item}
              residentLabel={catalog.profileLabel(item.residentId)}
              zoneLabel="—"
              onResolve={handleResolve}
              onView={handleResolve}
            />
          ))}
        </div>
      )}
    </PageShell>
  )
}
