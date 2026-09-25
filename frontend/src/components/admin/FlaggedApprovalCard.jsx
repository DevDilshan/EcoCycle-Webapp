import { formatCompactDate, formatRequestId, inferCategory } from '../../lib/adminUi'
import AgentInsightPanel from './AgentInsightPanel'
import CategoryPill from './CategoryPill'

export default function FlaggedApprovalCard({
  approval,
  pickup,
  residentLabel,
  zoneLabel,
  busy,
  detail,
  detailLoading,
  onApprove,
  onReject,
  onRevision,
}) {
  // Prefer the category the agents actually decided on; fall back to guessing
  // from the description only when there is no agent result.
  const category =
    detail?.agentInsight?.category || pickup?.category || inferCategory(pickup?.description)
  const title = pickup?.description?.slice(0, 80) || approval.flagReason || 'Flagged pickup request'

  return (
    <article className="flagged-approval-card">
      <div className="flagged-approval-photo" aria-hidden>
        photo
      </div>
      <div className="flagged-approval-body">
        <div className="flagged-approval-meta">
          <span className="flagged-approval-id">#{formatRequestId(approval.pickupRequestId || approval.id)}</span>
          <CategoryPill category={category} />
          <span className="flagged-approval-tag flagged-approval-tag-danger">Requires approval</span>
        </div>
        <h3 className="flagged-approval-title">{title}</h3>
        <p className="flagged-approval-sub">
          {residentLabel || 'Resident'} · {zoneLabel || '—'} · submitted {formatCompactDate(approval.createdAt)}
        </p>
        <div className="flagged-approval-reason">
          <strong>🚩 Flagged because:</strong> {approval.flagReason || 'Manual review required.'}
        </div>
        <AgentInsightPanel
          insight={detail?.agentInsight}
          note={detail?.agentResultNote}
          loading={detailLoading}
        />
      </div>
      <div className="flagged-approval-actions">
        <button
          type="button"
          className="btn-primary btn-sm flagged-approval-btn"
          disabled={busy}
          onClick={() => onApprove(approval.id)}
        >
          Approve
        </button>
        <button
          type="button"
          className="btn-danger btn-sm flagged-approval-btn"
          disabled={busy}
          onClick={() => onReject(approval.id)}
        >
          Reject
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm flagged-approval-btn"
          disabled={busy}
          onClick={() => onRevision?.(approval.id)}
        >
          Request revision
        </button>
      </div>
    </article>
  )
}
