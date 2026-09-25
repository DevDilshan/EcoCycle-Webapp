import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageShell from '../../components/PageShell'
import AdminAlert from '../../components/admin/AdminAlert'
import AdminCard from '../../components/admin/AdminCard'
import EntitySelect from '../../components/admin/EntitySelect'
import FlaggedApprovalCard from '../../components/admin/FlaggedApprovalCard'
import { useAdminCatalog } from '../../hooks/useAdminCatalog'
import { shortProfileName } from '../../lib/adminUi'
import { apiRequest } from '../../lib/api'

export default function ApprovalsPage() {
  const catalog = useAdminCatalog()
  // Pickup Requests links here as /admin/approvals?approval=<id> so an admin can
  // jump straight from a flagged pickup to the request that flagged it.
  const [searchParams] = useSearchParams()
  const targetId = searchParams.get('approval') || null
  const cardRefs = useRef(new Map())
  const hasScrolledToTarget = useRef(false)
  const [approvals, setApprovals] = useState([])
  const [details, setDetails] = useState({})
  const [loading, setLoading] = useState(true)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [warning, setWarning] = useState(null)
  const [approvalForm, setApprovalForm] = useState({ approvalId: '', notes: '', reason: '' })
  const [busy, setBusy] = useState(false)

  // The pending queue now comes from the API rather than from localStorage, so
  // an admin sees every flagged request -- including ones raised on another
  // machine, or by a resident's submission rather than by this browser.
  async function refreshApprovals() {
    setLoading(true)
    try {
      const page = await apiRequest('/approvals?status=Pending&pageSize=50')
      const items = page.items ?? []
      setApprovals(items)
      loadDetails(items)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Each card needs the agent's reasoning, which only the detail endpoint
  // returns. The pending queue is small, so fetching them together is simpler
  // than making the admin expand each card to find out what the AI thought.
  async function loadDetails(items) {
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
      setDetails(next)
    } finally {
      setDetailsLoading(false)
    }
  }

  useEffect(() => {
    refreshApprovals()
    window.addEventListener('ecocycle-approvals-updated', refreshApprovals)
    return () => window.removeEventListener('ecocycle-approvals-updated', refreshApprovals)
  }, [])

  // Scroll to the linked request once the queue has rendered. Guarded so that
  // approving something -- which reloads the list -- does not yank the page back
  // to where the admin arrived.
  useEffect(() => {
    if (!targetId || hasScrolledToTarget.current) return
    const node = cardRefs.current.get(targetId)
    if (!node) return
    hasScrolledToTarget.current = true
    node.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [targetId, approvals])

  // A linked request that is not in the pending queue was already dealt with;
  // say so rather than showing an apparently unrelated list.
  const targetMissing =
    Boolean(targetId) && !loading && !approvals.some((item) => item.id === targetId)

  const approvalOptions = approvals.map((item) => ({
    value: item.id,
    label: `${item.flagReason}`,
  }))

  async function approveById(id, notes = '') {
    setBusy(true)
    setError(null)
    setSuccess(null)
    setWarning(null)
    try {
      const result = await apiRequest(`/approvals/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ notes: notify(notes) }),
      })
      // routingWarning is null when the pickup was scheduled. When it is set the
      // approval saved but no collector was assigned, and the admin has to act.
      if (result?.routingWarning) {
        setWarning(`Approved, but not scheduled: ${result.routingWarning}`)
      } else {
        setSuccess('Approved and assigned to a collector.')
      }
      setApprovalForm({ approvalId: '', notes: '', reason: '' })
      await refreshApprovals()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function notify(notes) {
    return notes || undefined
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
      await refreshApprovals()
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

  async function handleCardApprove(id) {
    await approveById(id)
  }

  async function handleCardReject(id) {
    const reason = window.prompt('Rejection reason:')
    if (reason) await rejectById(id, reason)
  }

  function getPickup(approval) {
    return catalog.pickups.find((p) => p.id === approval.pickupRequestId)
  }

  return (
    <PageShell
      title="Approval queue"
      eyebrow={null}
      description={`${approvals.length} request${approvals.length === 1 ? '' : 's'} flagged by the Validator Agent — awaiting your decision`}
      actions={(
        <div className="admin-header-tabs">
          <span className="admin-header-tab admin-header-tab-active">
            Pending {approvals.length}
          </span>
          <span className="admin-header-tab">Resolved</span>
        </div>
      )}
    >
      <AdminAlert type="error" message={error || catalog.error} onClose={() => setError(null)} />
      <AdminAlert type="success" message={success} onClose={() => setSuccess(null)} />
      <AdminAlert type="error" message={warning} onClose={() => setWarning(null)} />

      {targetMissing && (
        <p className="admin-empty">
          The request you followed here is no longer pending — it has already been reviewed.
        </p>
      )}

      {loading ? (
        <p className="admin-empty">Loading flagged requests…</p>
      ) : approvals.length === 0 ? (
        <p className="admin-empty">Nothing is waiting for review. Flagged pickups appear here automatically.</p>
      ) : (
        <section className="flagged-approval-queue">
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
                className={isTarget ? 'flagged-approval-target' : undefined}
              >
              <FlaggedApprovalCard
                approval={approval}
                pickup={pickup}
                residentLabel={profile ? shortProfileName(profile) : 'Resident'}
                zoneLabel="—"
                busy={busy}
                detail={details[approval.id]}
                detailLoading={detailsLoading && !details[approval.id]}
                onApprove={handleCardApprove}
                onReject={handleCardReject}
                onRevision={() => setError('Request revision is not yet implemented on the backend.')}
              />
              </div>
            )
          })}
        </section>
      )}

      <AdminCard title="Review by ID" subtitle="Select a recent flagged pickup or paste an approval ID">
        <form className="admin-form">
          <div className="admin-form-row">
            {approvalOptions.length > 0 && (
              <EntitySelect
                id="approval-select"
                label="Recent flagged approvals"
                value={approvalForm.approvalId}
                onChange={(value) => setApprovalForm({ ...approvalForm, approvalId: value })}
                options={approvalOptions}
                placeholder="Select approval from recent flags"
              />
            )}
            <div>
              <label>Approval request ID</label>
              <input
                value={approvalForm.approvalId}
                onChange={(e) => setApprovalForm({ ...approvalForm, approvalId: e.target.value })}
                placeholder="From classify-evaluate response"
              />
            </div>
            <div>
              <label>Approve notes (optional)</label>
              <input value={approvalForm.notes} onChange={(e) => setApprovalForm({ ...approvalForm, notes: e.target.value })} />
            </div>
            <div>
              <label>Reject reason</label>
              <input value={approvalForm.reason} onChange={(e) => setApprovalForm({ ...approvalForm, reason: e.target.value })} />
            </div>
          </div>
          <div className="admin-actions">
            <button type="button" className="btn-primary btn-sm" disabled={busy || !approvalForm.approvalId} onClick={handleApprove}>Approve</button>
            <button type="button" className="btn-danger btn-sm" disabled={busy || !approvalForm.approvalId} onClick={handleReject}>Reject</button>
            <Link to="/admin/pickup-requests" className="btn-secondary btn-sm">Go to pickups</Link>
          </div>
        </form>
      </AdminCard>
    </PageShell>
  )
}
