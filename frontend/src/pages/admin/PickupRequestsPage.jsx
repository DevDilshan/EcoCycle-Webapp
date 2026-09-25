import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageShell from '../../components/PageShell'
import AdminAlert from '../../components/admin/AdminAlert'
import CategoryPill from '../../components/admin/CategoryPill'
import FilterPills from '../../components/admin/FilterPills'
import PickupStatusPill from '../../components/admin/PickupStatusPill'
import { useAdminCatalog } from '../../hooks/useAdminCatalog'
import {
  FILTER_PILL_STYLES,
  formatCompactDate,
  formatRequestId,
  shortProfileName,
} from '../../lib/adminUi'
import { apiRequest } from '../../lib/api'

const STATUS_FILTERS = ['', 'Pending', 'Classified', 'Scheduled', 'Completed']

// Classification timestamps are worth showing to the minute: an admin comparing
// a pickup against its approval wants to know these happened seconds apart.
function formatClassifiedAt(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

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
            const classified = Boolean(item.category)
            const expanded = expandedId === item.id
            const classifiedAt = formatClassifiedAt(item.classifiedAt)

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
                  <span>
                    {classified
                      ? <CategoryPill category={item.category} />
                      : <span className="pickup-grid-muted">Not classified</span>}
                  </span>
                  <span className="pickup-grid-muted">{item.zoneName || '—'}</span>
                  <span className="pickup-grid-muted">{formatCompactDate(item.preferredDate)}</span>
                  <span><PickupStatusPill status={item.status} /></span>
                </button>
                {expanded && (
                  <div className="pickup-grid-detail">
                    <p><strong>Description:</strong> {item.description || '—'}</p>

                    {classified ? (
                      <div className="pickup-classification">
                        <p>
                          <strong>Classified as:</strong> {item.category}
                          {typeof item.confidence === 'number' && (
                            <> · {Math.round(item.confidence * 100)}% confident</>
                          )}
                          {classifiedAt && <> · {classifiedAt}</>}
                        </p>
                        {item.reasoning && (
                          <p><strong>Reasoning:</strong> {item.reasoning}</p>
                        )}
                      </div>
                    ) : (
                      <div className="pickup-classification pickup-classification-missing">
                        <p><strong>Not yet classified.</strong></p>
                        <p>
                          Pickups are classified automatically when a resident submits them.
                          This one was not, so the agent service was unavailable or skipped it.
                        </p>
                      </div>
                    )}

                    {item.hasApprovalRequest && (
                      <div className="pickup-flag">
                        <p>
                          <strong>🚩 Flagged for review</strong>
                          {item.approvalStatus && <> · {item.approvalStatus}</>}
                        </p>
                        {item.flagReason && <p>{item.flagReason}</p>}
                        <Link
                          to={`/admin/approvals?approval=${item.approvalRequestId ?? ''}`}
                          className="btn-secondary btn-sm"
                        >
                          Review in Approvals
                        </Link>
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

