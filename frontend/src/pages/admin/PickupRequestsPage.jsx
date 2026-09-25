import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import PageShell from '../../components/PageShell'
import AdminAlert from '../../components/admin/AdminAlert'
import CategoryPill from '../../components/admin/CategoryPill'
import FilterPills from '../../components/admin/FilterPills'
import PickupStatusPill from '../../components/admin/PickupStatusPill'
import { useAdminCatalog } from '../../hooks/useAdminCatalog'
import { storeApproval } from '../../lib/approvals'
import {
  FILTER_PILL_STYLES,
  formatCompactDate,
  formatRequestId,
  inferCategory,
  shortProfileName,
} from '../../lib/adminUi'
import { apiRequest } from '../../lib/api'

const CATEGORIES = ['Organic', 'Recyclable', 'Hazardous', 'EWaste', 'General', 'Bulk']
const STATUS_FILTERS = ['', 'Pending', 'Classified', 'Scheduled', 'Completed']

export default function PickupRequestsPage() {
  const catalog = useAdminCatalog()
  const [items, setItems] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [statusCounts, setStatusCounts] = useState({})
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [classifyForm, setClassifyForm] = useState({
    category: 'Recyclable',
    confidence: 0.92,
    reasoning: '',
  })
  const [approvalNotes, setApprovalNotes] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [lastApproval, setLastApproval] = useState(null)
  const [busyId, setBusyId] = useState(null)

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
    () => STATUS_FILTERS.map((status) => ({
      key: status,
      label: FILTER_PILL_STYLES[status].label,
      className: FILTER_PILL_STYLES[status].className,
      count: statusCounts[status || 'all'],
    })),
    [statusCounts],
  )

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter((item) => {
      const resident = catalog.profileLabel(item.residentId).toLowerCase()
      const id = formatRequestId(item.id).toLowerCase()
      const desc = (item.description || '').toLowerCase()
      return resident.includes(q) || id.includes(q) || desc.includes(q)
    })
  }, [items, search, catalog])

  async function handleStubClassify(id) {
    setBusyId(id)
    setError(null)
    setSuccess(null)
    try {
      await apiRequest(`/pickuprequests/${id}/classify`, { method: 'POST' })
      setSuccess('Pickup classified (stub).')
      load()
      loadCounts()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleClassifyEvaluate(id) {
    setBusyId(id)
    setError(null)
    setSuccess(null)
    setLastApproval(null)
    try {
      const result = await apiRequest(`/pickuprequests/${id}/classify-evaluate`, {
        method: 'POST',
        body: JSON.stringify(classifyForm),
      })
      if (result.flagged && result.approvalRequest) {
        storeApproval(result.approvalRequest)
        setLastApproval({ pickupId: id, ...result.approvalRequest })
        setSuccess(`Flagged: ${result.violations.join('; ')}`)
      } else {
        setSuccess('Pickup passed compliance and was auto-approved.')
      }
      load()
      loadCounts()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleApprove(approvalId) {
    setBusyId(approvalId)
    setError(null)
    try {
      await apiRequest(`/approvals/${approvalId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ notes: approvalNotes || undefined }),
      })
      setSuccess('Approval request approved.')
      setLastApproval(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(approvalId) {
    if (!rejectReason.trim()) {
      setError('Rejection reason is required.')
      return
    }
    setBusyId(approvalId)
    setError(null)
    try {
      await apiRequest(`/approvals/${approvalId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason }),
      })
      setSuccess('Approval request rejected.')
      setLastApproval(null)
      setRejectReason('')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleAssignRoute(id) {
    setBusyId(id)
    setError(null)
    try {
      await apiRequest(`/routes/assign/${id}`, { method: 'POST' })
      setSuccess('Pickup assigned to route.')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / 20))

  return (
    <PageShell
      title="Pickup requests"
      eyebrow={null}
      description="All resident submissions across zones"
      showSearch
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by ID, resident, zone…"
      filterBar={(
        <FilterPills
          options={filterOptions}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      )}
    >
      <AdminAlert type="error" message={error || catalog.error} onClose={() => setError(null)} />
      <AdminAlert type="success" message={success} onClose={() => setSuccess(null)} />

      {lastApproval && (
        <div className="admin-inline-panel">
          <p><strong>Pending approval — {formatRequestId(lastApproval.id)}</strong> · {lastApproval.flagReason}</p>
          <div className="admin-actions">
            <input value={approvalNotes} onChange={(e) => setApprovalNotes(e.target.value)} placeholder="Approve notes (optional)" />
            <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reject reason" />
            <button type="button" className="btn-primary btn-sm" disabled={busyId === lastApproval.id} onClick={() => handleApprove(lastApproval.id)}>Approve</button>
            <button type="button" className="btn-danger btn-sm" disabled={busyId === lastApproval.id} onClick={() => handleReject(lastApproval.id)}>Reject</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="admin-loading">Loading pickup requests…</p>
      ) : filteredItems.length === 0 ? (
        <p className="admin-empty">No pickup requests found.</p>
      ) : (
        <div className="pickup-grid-table">
          <div className="pickup-grid-header">
            <span>ID</span>
            <span>Resident / item</span>
            <span>Category</span>
            <span>Zone</span>
            <span>Preferred</span>
            <span>Status</span>
          </div>
          {filteredItems.map((item) => {
            const profile = catalog.profileMap.get(item.residentId)
            const residentName = shortProfileName(profile)
            const category = inferCategory(item.description)
            const expanded = expandedId === item.id

            return (
              <Fragment key={item.id}>
                <button
                  type="button"
                  className="pickup-grid-row"
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                >
                  <span className="pickup-grid-id">{formatRequestId(item.id)}</span>
                  <span className="pickup-grid-resident">
                    <strong>{residentName}</strong>
                    <small>{item.description?.slice(0, 48) || 'No description'}</small>
                  </span>
                  <span><CategoryPill category={category} /></span>
                  <span className="pickup-grid-muted">—</span>
                  <span className="pickup-grid-muted">{formatCompactDate(item.preferredDate)}</span>
                  <span><PickupStatusPill status={item.status} /></span>
                </button>
                {expanded && (
                  <div className="pickup-grid-detail">
                    <p><strong>Description:</strong> {item.description || '—'}</p>
                    {item.status === 'Pending' && (
                      <div className="admin-form">
                        <div className="admin-actions">
                          <button type="button" className="btn-secondary btn-sm" disabled={busyId === item.id} onClick={() => handleStubClassify(item.id)}>
                            Quick classify (stub)
                          </button>
                        </div>
                        <div className="admin-form-row">
                          <div>
                            <label>Category</label>
                            <select value={classifyForm.category} onChange={(e) => setClassifyForm({ ...classifyForm, category: e.target.value })}>
                              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div>
                            <label>Confidence (0–1)</label>
                            <input type="number" min="0" max="1" step="0.01" value={classifyForm.confidence} onChange={(e) => setClassifyForm({ ...classifyForm, confidence: Number(e.target.value) })} />
                          </div>
                        </div>
                        <div>
                          <label>Reasoning</label>
                          <textarea value={classifyForm.reasoning} onChange={(e) => setClassifyForm({ ...classifyForm, reasoning: e.target.value })} placeholder="Describe what the classifier detected…" />
                        </div>
                        <button type="button" className="btn-primary btn-sm" disabled={busyId === item.id || !classifyForm.reasoning.trim()} onClick={() => handleClassifyEvaluate(item.id)}>
                          Classify & evaluate compliance
                        </button>
                      </div>
                    )}
                    {item.status === 'Approved' && (
                      <button type="button" className="btn-secondary btn-sm" disabled={busyId === item.id} onClick={() => handleAssignRoute(item.id)}>
                        Assign route
                      </button>
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

