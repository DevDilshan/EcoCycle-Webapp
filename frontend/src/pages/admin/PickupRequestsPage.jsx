import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Flag } from 'lucide-react'
import PageShell from '../../components/admin/AdminPageShell'
import { AcAlert, AcChips, AcDrawer, AcToast } from '../../components/admin/AcUi'
import { AcCategory, AcStatusPill } from '../../components/admin/AcPills'
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
  const [openId, setOpenId] = useState(null)
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
  const openItem = items.find((item) => item.id === openId) || null
  const openProfile = openItem ? catalog.profileMap.get(openItem.residentId) : null

  // A request is only "flagged" while its approval is still waiting; once an
  // admin has acted the underlying pickup status is the truthful thing to show.
  function statusFor(item) {
    const flagged = item.hasApprovalRequest && item.approvalStatus === 'Pending'
    return flagged ? 'Flagged' : item.status
  }

  return (
    <PageShell
      title="Pickup requests"
      description="All resident submissions across zones"
      showSearch
      showBell
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by ID, resident, description…"
      filterBar={(
        <div className="ac-toolbar">
          <AcChips
            options={filterOptions}
            value={statusFilter}
            onChange={setStatusFilter}
            label="Filter by status"
          />
          <span className="ac-toolbar-meta">{filteredItems.length} of {totalCount} requests</span>
        </div>
      )}
    >
      <AcAlert message={error || catalog.error} onClose={() => setError(null)} />

      <section className="ac-card">
        {loading ? (
          <p className="ac-empty">Loading pickup requests…</p>
        ) : filteredItems.length === 0 ? (
          <p className="ac-empty">No pickup requests found.</p>
        ) : (
          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Resident / item</th>
                  <th>Category</th>
                  <th>Zone</th>
                  <th>Preferred</th>
                  <th>Status</th>
                  <th><span className="ac-sr-only">Open details</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    tabIndex={0}
                    onClick={() => setOpenId(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setOpenId(item.id)
                      }
                    }}
                  >
                    <td className="ac-id">{formatRequestId(item.id)}</td>
                    <td>
                      <strong>{shortProfileName(catalog.profileMap.get(item.residentId))}</strong>
                      <span className="ac-sub">{item.description?.slice(0, 48) || 'No description'}</span>
                    </td>
                    <td><AcCategory category={item.category} confidence={item.confidence} /></td>
                    <td>{item.zoneName || '—'}</td>
                    <td>{formatCompactDate(item.preferredDate)}</td>
                    <td><AcStatusPill status={statusFor(item)} /></td>
                    <td className="ac-chevron">
                      <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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

      <AcDrawer
        open={Boolean(openItem)}
        onClose={() => setOpenId(null)}
        title={openItem ? formatRequestId(openItem.id) : 'Request'}
      >
        {openItem && (
          <>
            <div className="ac-drawer-pills">
              <AcStatusPill status={statusFor(openItem)} />
              <AcCategory category={openItem.category} confidence={openItem.confidence} />
            </div>

            <dl className="ac-kv">
              <dt>Resident</dt>
              <dd>{shortProfileName(openProfile)}</dd>
              <dt>Zone</dt>
              <dd>{openItem.zoneName || 'Not assigned'}</dd>
              <dt>Preferred</dt>
              <dd>{formatCompactDate(openItem.preferredDate)}</dd>
              {openItem.classifiedAt && (
                <>
                  <dt>Classified</dt>
                  <dd>{formatClassifiedAt(openItem.classifiedAt)}</dd>
                </>
              )}
              {openItem.isRecurring && (
                <>
                  <dt>Recurring</dt>
                  <dd>{openItem.recurrenceInterval || 'Yes'}</dd>
                </>
              )}
            </dl>

            <div>
              <h3 className="ac-drawer-sub">Description</h3>
              <p className="ac-drawer-text">{openItem.description || 'No description given.'}</p>
            </div>

            {openItem.category ? (
              openItem.reasoning && (
                <div className="ac-insight">
                  <h4>Classifier reasoning</h4>
                  <p>{openItem.reasoning}</p>
                </div>
              )
            ) : (
              <div className="ac-insight">
                <h4>Not yet classified</h4>
                <p>
                  Pickups are classified automatically when a resident submits them. This one was
                  not, so the agent service was unavailable or skipped it.
                </p>
              </div>
            )}

            {openItem.hasApprovalRequest && (
              <div className="ac-reason">
                <Flag size={18} strokeWidth={2} aria-hidden="true" />
                <span>
                  <strong>Flagged for review</strong>
                  {openItem.approvalStatus ? ` · ${openItem.approvalStatus}` : null}
                  {openItem.flagReason ? <><br />{openItem.flagReason}</> : null}
                </span>
              </div>
            )}

            <div className="ac-actions">
              {openItem.hasApprovalRequest && (
                <Link
                  to={`/admin/approvals?approval=${openItem.approvalRequestId ?? ''}`}
                  className="ac-btn ac-btn-ghost"
                >
                  Review in Approvals
                </Link>
              )}
              {openItem.status === 'Approved' && (
                <button
                  type="button"
                  className="ac-btn ac-btn-primary"
                  disabled={busyId === openItem.id}
                  onClick={() => handleAssignRoute(openItem.id)}
                >
                  Assign route
                </button>
              )}
            </div>
          </>
        )}
      </AcDrawer>

      <AcToast message={success} />
    </PageShell>
  )
}
