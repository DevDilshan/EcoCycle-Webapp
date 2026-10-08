import { useCallback, useEffect, useMemo, useState } from 'react'
import PageShell from '../../components/admin/AdminPageShell'
import { AcAlert, AcCard, AcChips, AcDrawer, AcToast } from '../../components/admin/AcUi'
import { AcStatusPill } from '../../components/admin/AcPills'
import ComplaintRowCard from '../../components/admin/ComplaintRowCard'
import { useAdminCatalog } from '../../hooks/useAdminCatalog'
import { formatCompactDate, formatRequestId } from '../../lib/adminUi'
import { apiRequest } from '../../lib/api'

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'Open', label: 'Open' },
  { key: 'InProgress', label: 'In review' },
  { key: 'Resolved', label: 'Resolved' },
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
      setLoading(false)
      void loadCounts()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }, [statusFilter, loadCounts])

  useEffect(() => { load() }, [load])

  const resolvedRate = counts.total
    ? Math.round((counts.Resolved / counts.total) * 100)
    : 0

  const tabs = useMemo(
    () => STATUS_TABS.map((tab) => ({
      ...tab,
      count: tab.key ? counts[tab.key] : counts.total,
    })),
    [counts],
  )

  const editing = items.find((item) => item.id === editingId) || null

  function handleResolve(complaint) {
    setEditingId(complaint.id)
    setEditForm({ status: complaint.status || 'Resolved', adminNotes: complaint.adminNotes || '' })
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
      description={`${counts.Open} open · ${resolvedRate}% resolved overall`}
      showBell
      hasAlerts={counts.Open > 0}
      filterBar={(
        <div className="ac-toolbar">
          <AcChips
            options={tabs}
            value={statusFilter}
            onChange={setStatusFilter}
            label="Filter by status"
          />
        </div>
      )}
    >
      <AcAlert message={error || catalog.error} onClose={() => setError(null)} />

      <AcCard>
        {loading ? (
          <p className="ac-empty">Loading complaints…</p>
        ) : items.length === 0 ? (
          <p className="ac-empty">No complaints found.</p>
        ) : (
          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead>
                <tr>
                  <th>Complaint</th>
                  <th>Resident / issue</th>
                  <th>Type</th>
                  <th>Raised</th>
                  <th>Status</th>
                  <th><span className="ac-sr-only">Open details</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <ComplaintRowCard
                    key={item.id}
                    complaint={item}
                    residentLabel={catalog.profileLabel(item.residentId)}
                    onView={handleResolve}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AcCard>

      <AcDrawer
        open={Boolean(editing)}
        onClose={() => setEditingId(null)}
        title={editing ? formatRequestId(editing.id, 'CMP') : 'Complaint'}
      >
        {editing && (
          <>
            <div className="ac-drawer-pills">
              <AcStatusPill status={editing.status} />
            </div>

            <dl className="ac-kv">
              <dt>Resident</dt>
              <dd>{catalog.profileLabel(editing.residentId)}</dd>
              <dt>Raised</dt>
              <dd>{formatCompactDate(editing.createdAt)}</dd>
              {editing.resolvedAt && (
                <>
                  <dt>Resolved</dt>
                  <dd>{formatCompactDate(editing.resolvedAt)}</dd>
                </>
              )}
              {editing.pickupRequestId && (
                <>
                  <dt>Pickup</dt>
                  <dd>{formatRequestId(editing.pickupRequestId)}</dd>
                </>
              )}
            </dl>

            <div>
              <h3 className="ac-drawer-sub">What the resident said</h3>
              <p className="ac-drawer-text">{editing.description || 'No description given.'}</p>
            </div>

            <form className="ac-form" onSubmit={handleUpdate}>
              <div className="ac-field">
                <label htmlFor="complaint-status">Status</label>
                <select
                  id="complaint-status"
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                >
                  <option value="Open">Open</option>
                  <option value="InProgress">In review</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>
              <div className="ac-field">
                <label htmlFor="complaint-notes">Admin notes</label>
                <textarea
                  id="complaint-notes"
                  rows={4}
                  value={editForm.adminNotes}
                  onChange={(e) => setEditForm({ ...editForm, adminNotes: e.target.value })}
                />
              </div>
              <div className="ac-actions">
                <button type="submit" className="ac-btn ac-btn-primary" disabled={busy}>Save</button>
                <button type="button" className="ac-btn ac-btn-ghost" onClick={() => setEditingId(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </>
        )}
      </AcDrawer>

      <AcToast message={success} onDone={() => setSuccess(null)} />
    </PageShell>
  )
}
