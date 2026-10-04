import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageShell from '../../components/admin/AdminPageShell'
import { AcAlert, AcCard, AcChips, AcToast } from '../../components/admin/AcUi'
import EntitySelect from '../../components/admin/EntitySelect'
import FlaggedApprovalCard from '../../components/admin/FlaggedApprovalCard'
import { useAdminCatalog } from '../../hooks/useAdminCatalog'
import { formatRequestId, shortProfileName } from '../../lib/adminUi'
import { APPROVALS_UPDATED_EVENT, notifyApprovalsUpdated } from '../../lib/approvalEvents'
import { apiRequest } from '../../lib/api'
import { pagedTotalCount } from '../../lib/paging'

const STATUS_TABS = [
  { key: 'Pending', label: 'Pending review' },
  { key: 'Approved', label: 'Approved' },
  { key: 'Rejected', label: 'Rejected' },
]

export default function ApprovalsPage() {
  const catalog = useAdminCatalog()
  const [searchParams] = useSearchParams()
  const targetId = searchParams.get('approval') || null
  const cardRefs = useRef(new Map())
  const hasScrolledToTarget = useRef(false)
  const resolvedTargetTab = useRef(false)

  const [statusFilter, setStatusFilter] = useState('Pending')
  const [counts, setCounts] = useState({ Pending: 0, Approved: 0, Rejected: 0 })
  const [approvals, setApprovals] = useState([])
  const [details, setDetails] = useState({})
  const [loading, setLoading] = useState(true)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [warning, setWarning] = useState(null)
  const [approvalForm, setApprovalForm] = useState({ approvalId: '', notes: '', reason: '' })
  const [busy, setBusy] = useState(false)

  const loadCounts = useCallback(async () => {
    const [pending, approved, rejected] = await Promise.all([
      apiRequest('/approvals?status=Pending&pageSize=1'),
      apiRequest('/approvals?status=Approved&pageSize=1'),
      apiRequest('/approvals?status=Rejected&pageSize=1'),
    ])
    const next = {
      Pending: pagedTotalCount(pending),
      Approved: pagedTotalCount(approved),
      Rejected: pagedTotalCount(rejected),
    }
    setCounts(next)
    return next
  }, [])

  const loadDetails = useCallback(async (items) => {
    if (items.length === 0) return
    setDetailsLoading(true)
    try {
      const loaded = await Promise.all(
        items.map((item) =>
          apiRequest(`/approvals/${item.id}`).catch(() => null),
        ),
      )
      const next = {}
      items.forEach((item, index) => {
        if (loaded[index]) next[item.id] = loaded[index]
      })
      setDetails((prev) => ({ ...prev, ...next }))
    } finally {
      setDetailsLoading(false)
    }
  }, [])

  const refreshApprovals = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({ pageSize: '50', status: statusFilter })
      const page = await apiRequest(`/approvals?${query}`)
      const items = page.items ?? []
      setApprovals(items)
      const counts = await loadCounts()
      loadDetails(items)
      return counts
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [statusFilter, loadCounts, loadDetails])

  useEffect(() => {
    refreshApprovals()
  }, [refreshApprovals])

  useEffect(() => {
    const onUpdate = () => refreshApprovals()
    window.addEventListener(APPROVALS_UPDATED_EVENT, onUpdate)
    return () => window.removeEventListener(APPROVALS_UPDATED_EVENT, onUpdate)
  }, [refreshApprovals])

  // Deep link from pickup requests: open the tab that contains this approval.
  useEffect(() => {
    if (!targetId || resolvedTargetTab.current) return
    let cancelled = false
    ;(async () => {
      try {
        const detail = await apiRequest(`/approvals/${targetId}`)
        if (cancelled || !detail?.status) return
        resolvedTargetTab.current = true
        if (detail.status !== statusFilter && STATUS_TABS.some((t) => t.key === detail.status)) {
          setStatusFilter(detail.status)
        }
      } catch {
        resolvedTargetTab.current = true
      }
    })()
    return () => { cancelled = true }
  }, [targetId, statusFilter])

  useEffect(() => {
    if (!targetId || hasScrolledToTarget.current) return
    const node = cardRefs.current.get(targetId)
    if (!node) return
    hasScrolledToTarget.current = true
    node.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [targetId, approvals])

  const tabs = useMemo(
    () => STATUS_TABS.map((tab) => ({
      ...tab,
      count: counts[tab.key] ?? 0,
    })),
    [counts],
  )

  const isPendingView = statusFilter === 'Pending'

  const approvalOptions = useMemo(
    () => (isPendingView ? approvals : []).map((item) => {
      const pickup = catalog.pickups.find((p) => p.id === item.pickupRequestId)
      const pickupRef = formatRequestId(item.pickupRequestId, 'PR')
      const reason = item.flagReason?.trim() || 'Manual review required'
      const reasonShort = reason.length > 48 ? `${reason.slice(0, 48)}…` : reason
      const resident = pickup
        ? shortProfileName(catalog.profileMap.get(pickup.residentId))
        : null
      const label = resident
        ? `${pickupRef} · ${resident} — ${reasonShort}`
        : `${pickupRef} — ${reasonShort}`
      return { value: item.id, label, approvalRef: formatRequestId(item.id, 'APR'), reason }
    }),
    [approvals, catalog.pickups, catalog.profileMap, isPendingView],
  )

  const selectedApproval = approvalOptions.find((o) => o.value === approvalForm.approvalId)

  useEffect(() => {
    if (!isPendingView || loading) return
    setApprovalForm((form) => {
      if (targetId && approvals.some((a) => a.id === targetId)) {
        return form.approvalId === targetId ? form : { ...form, approvalId: targetId }
      }
      if (form.approvalId && approvals.some((a) => a.id === form.approvalId)) {
        return form
      }
      if (approvals.length === 1) {
        return { ...form, approvalId: approvals[0].id }
      }
      if (form.approvalId) {
        return { ...form, approvalId: '' }
      }
      return form
    })
  }, [loading, approvals, targetId, isPendingView])

  const targetMissing =
    Boolean(targetId)
    && isPendingView
    && !loading
    && resolvedTargetTab.current
    && !approvals.some((item) => item.id === targetId)

  const pageDescription = isPendingView
    ? `${counts.Pending} request${counts.Pending === 1 ? '' : 's'} awaiting your decision`
    : statusFilter === 'Approved'
      ? `${counts.Approved} approved decision${counts.Approved === 1 ? '' : 's'} on record`
      : `${counts.Rejected} rejected decision${counts.Rejected === 1 ? '' : 's'} on record`

  const emptyMessage = isPendingView
    ? 'Nothing is waiting for review. Flagged pickups appear here automatically.'
    : statusFilter === 'Approved'
      ? 'No approved approvals yet.'
      : 'No rejected approvals yet.'

  async function approveById(id, notes = '') {
    setBusy(true)
    setError(null)
    setSuccess(null)
    setWarning(null)
    try {
      const result = await apiRequest(`/approvals/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ notes: notes || undefined }),
      })
      if (result?.routingWarning) {
        setWarning(`Approved, but not scheduled: ${result.routingWarning}`)
      } else {
        setSuccess('Approved and assigned to a collector.')
      }
      setApprovalForm({ approvalId: '', notes: '', reason: '' })
      const counts = await refreshApprovals()
      if (counts) notifyApprovalsUpdated(counts.Pending)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function rejectById(id, reason) {
    if (!reason?.trim()) {
      setError('Rejection reason is required.')
      return
    }
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await apiRequest(`/approvals/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      })
      setSuccess('Approval request rejected.')
      setApprovalForm({ approvalId: '', notes: '', reason: '' })
      const counts = await refreshApprovals()
      if (counts) notifyApprovalsUpdated(counts.Pending)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleApprove(e) {
    e.preventDefault()
    await approveById(approvalForm.approvalId, approvalForm.notes)
  }

  async function handleReject(e) {
    e.preventDefault()
    await rejectById(approvalForm.approvalId, approvalForm.reason)
  }

  function getPickup(approval) {
    return catalog.pickups.find((p) => p.id === approval.pickupRequestId)
  }

  function zoneLabelFor(pickup) {
    if (!pickup) return null
    return pickup.zoneName || catalog.zoneMap.get(pickup.zoneId)?.name || null
  }

  return (
    <PageShell
      title="Approvals"
      description={pageDescription}
      showBell
      hasAlerts={counts.Pending > 0}
      filterBar={(
        <div className="ac-toolbar">
          <AcChips
            options={tabs}
            value={statusFilter}
            onChange={setStatusFilter}
            label="Show approvals"
          />
        </div>
      )}
    >
      <AcAlert message={error || catalog.error} onClose={() => setError(null)} />
      <AcAlert message={warning} onClose={() => setWarning(null)} />

      {targetMissing && (
        <p className="ac-empty">
          The linked approval is no longer pending — check the Approved or Rejected tab for history.
        </p>
      )}

      {loading ? (
        <p className="ac-empty">Loading approvals…</p>
      ) : approvals.length === 0 ? (
        <AcCard>
          <p className="ac-empty">{emptyMessage}</p>
        </AcCard>
      ) : (
        <div className="ac-grid">
          {approvals.map((approval) => {
            const pickup = getPickup(approval)
            const profile = pickup ? catalog.profileMap.get(pickup.residentId) : null
            const isTarget = approval.id === targetId
            return (
              <div
                key={approval.id}
                ref={(node) => {
                  if (node) cardRefs.current.set(approval.id, node)
                  else cardRefs.current.delete(approval.id)
                }}
                className={isTarget ? 'ac-approval-target' : undefined}
              >
                <FlaggedApprovalCard
                  approval={approval}
                  pickup={pickup}
                  residentLabel={profile ? shortProfileName(profile) : 'Resident'}
                  zoneLabel={zoneLabelFor(pickup)}
                  busy={busy}
                  readOnly={!isPendingView}
                  detail={details[approval.id]}
                  detailLoading={detailsLoading && !details[approval.id]}
                  onApprove={approveById}
                  onReject={rejectById}
                />
              </div>
            )
          })}
        </div>
      )}

      {isPendingView && (
        <AcCard title="Quick review" subtitle="Choose a pending approval, then approve or reject">
          {approvalOptions.length === 0 ? (
            <p className="ac-empty" style={{ margin: 0 }}>No pending items in the queue.</p>
          ) : (
            <div className="ac-form">
              <div className="ac-field">
                <EntitySelect
                  id="approval-select"
                  label="Pending approval"
                  value={approvalForm.approvalId}
                  onChange={(value) => setApprovalForm({ ...approvalForm, approvalId: value })}
                  options={approvalOptions}
                  placeholder="Select an approval request…"
                />
                {selectedApproval && (
                  <p className="ac-field-hint">
                    <span className="ac-id">{selectedApproval.approvalRef}</span>
                    {' · '}
                    {selectedApproval.reason}
                  </p>
                )}
              </div>
              <div className="ac-two">
                <div className="ac-field">
                  <label htmlFor="approval-notes">Approve notes (optional)</label>
                  <input
                    id="approval-notes"
                    value={approvalForm.notes}
                    onChange={(e) => setApprovalForm({ ...approvalForm, notes: e.target.value })}
                  />
                </div>
                <div className="ac-field">
                  <label htmlFor="approval-reason">Reject reason</label>
                  <input
                    id="approval-reason"
                    value={approvalForm.reason}
                    onChange={(e) => setApprovalForm({ ...approvalForm, reason: e.target.value })}
                    placeholder="Required when rejecting"
                  />
                </div>
              </div>
              <div className="ac-actions">
                <button
                  type="button"
                  className="ac-btn ac-btn-primary"
                  disabled={busy || !approvalForm.approvalId}
                  onClick={handleApprove}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="ac-btn ac-btn-danger"
                  disabled={busy || !approvalForm.approvalId}
                  onClick={handleReject}
                >
                  Reject
                </button>
                <Link to="/admin/pickup-requests" className="ac-btn ac-btn-ghost">Go to pickups</Link>
              </div>
            </div>
          )}
        </AcCard>
      )}

      <AcToast message={success} onDone={() => setSuccess(null)} />
    </PageShell>
  )
}
