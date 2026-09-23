import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageShell from '../../components/PageShell'
import AdminAlert from '../../components/admin/AdminAlert'
import AdminCard from '../../components/admin/AdminCard'
import EntitySelect from '../../components/admin/EntitySelect'
import FlaggedApprovalCard from '../../components/admin/FlaggedApprovalCard'
import { useAdminCatalog } from '../../hooks/useAdminCatalog'
import { loadStoredApprovals } from '../../lib/approvals'
import { shortProfileName } from '../../lib/adminUi'
import { apiRequest } from '../../lib/api'

export default function ApprovalsPage() {
  const catalog = useAdminCatalog()
  const [storedApprovals, setStoredApprovals] = useState([])
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [approvalForm, setApprovalForm] = useState({ approvalId: '', notes: '', reason: '' })
  const [busy, setBusy] = useState(false)

  function refreshStoredApprovals() {
    setStoredApprovals(loadStoredApprovals())
  }

  useEffect(() => {
    refreshStoredApprovals()
    window.addEventListener('ecocycle-approvals-updated', refreshStoredApprovals)
    return () => window.removeEventListener('ecocycle-approvals-updated', refreshStoredApprovals)
  }, [])

  const approvalOptions = storedApprovals.map((item) => ({
    value: item.id,
    label: `${item.flagReason}`,
  }))

  async function approveById(id, notes = '') {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await apiRequest(`/approvals/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ notes: notes || undefined }),
      })
      setSuccess('Approval request approved.')
      setApprovalForm({ approvalId: '', notes: '', reason: '' })
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
      description={`${storedApprovals.length} request${storedApprovals.length === 1 ? '' : 's'} flagged by the Validator Agent — awaiting your decision`}
      actions={(
        <div className="admin-header-tabs">
          <span className="admin-header-tab admin-header-tab-active">
            Pending {storedApprovals.length}
          </span>
          <span className="admin-header-tab">Resolved</span>
        </div>
      )}
    >
      <AdminAlert type="error" message={error || catalog.error} onClose={() => setError(null)} />
      <AdminAlert type="success" message={success} onClose={() => setSuccess(null)} />

      {storedApprovals.length === 0 ? (
        <p className="admin-empty">No flagged approvals yet. Run Classify & evaluate on Pickup Requests to flag items.</p>
      ) : (
        <section className="flagged-approval-queue">
          {storedApprovals.map((approval) => {
            const pickup = getPickup(approval)
            const profile = pickup ? catalog.profileMap.get(pickup.residentId) : null
            return (
              <FlaggedApprovalCard
                key={approval.id}
                approval={approval}
                pickup={pickup}
                residentLabel={profile ? shortProfileName(profile) : 'Resident'}
                zoneLabel="—"
                busy={busy}
                onApprove={handleCardApprove}
                onReject={handleCardReject}
                onRevision={() => setError('Request revision is not yet implemented on the backend.')}
              />
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
