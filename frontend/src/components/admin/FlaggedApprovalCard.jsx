import { useState } from 'react'
import { Calendar, Camera, Flag, MapPin, UserRound } from 'lucide-react'
import { formatCompactDate, formatRequestId, inferCategory } from '../../lib/adminUi'
import AgentInsightPanel from './AgentInsightPanel'
import { AcCategory, AcStatusPill } from './AcPills'

export default function FlaggedApprovalCard({
  approval,
  pickup,
  residentLabel,
  zoneLabel,
  busy,
  detail,
  detailLoading,
  readOnly = false,
  onApprove,
  onReject,
}) {
  // Reject needs a reason, so the field opens in place rather than in a browser
  // prompt: the admin can still see the flag and the photo while typing it.
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  // Prefer the category the agents actually decided on; fall back to guessing
  // from the description only when there is no agent result.
  const category =
    detail?.agentInsight?.category || pickup?.category || inferCategory(pickup?.description)
  const title = pickup?.description?.slice(0, 80) || approval.flagReason || 'Flagged pickup request'
  function submitReject() {
    const trimmed = reason.trim()
    if (!trimmed) return
    onReject(approval.id, trimmed)
    setReason('')
    setRejecting(false)
  }

  return (
    <article className="ac-approval">
      <div>
        <div className="ac-approval-head">
          <span className="ac-id">{formatRequestId(approval.pickupRequestId || approval.id)}</span>
          <AcCategory category={category} confidence={detail?.agentInsight?.confidence} />
          {readOnly ? (
            <AcStatusPill status={approval.status} />
          ) : (
            <AcStatusPill status="Flagged" label="Requires approval" />
          )}
        </div>

        <h3>{title}</h3>

        <div className="ac-facts">
          <span><UserRound size={15} strokeWidth={2} aria-hidden="true" />{residentLabel || 'Resident'}</span>
          <span><MapPin size={15} strokeWidth={2} aria-hidden="true" />{zoneLabel || 'No zone'}</span>
          <span><Calendar size={15} strokeWidth={2} aria-hidden="true" />Submitted {formatCompactDate(approval.createdAt)}</span>
        </div>

        <div className="ac-reason">
          <Flag size={18} strokeWidth={2} aria-hidden="true" />
          <span>
            <strong>Flagged because:</strong> {approval.flagReason || 'Manual review required.'}
          </span>
        </div>

        <AgentInsightPanel
          insight={detail?.agentInsight}
          note={detail?.agentResultNote}
          loading={detailLoading}
        />

        {readOnly && (
          <div className="ac-review-outcome">
            <p>
              <strong>Reviewed {formatCompactDate(approval.reviewedAt)}</strong>
            </p>
            {approval.reviewNotes ? (
              <p>
                <strong>{approval.status === 'Rejected' ? 'Rejection reason' : 'Admin notes'}:</strong>{' '}
                {approval.reviewNotes}
              </p>
            ) : (
              <p className="ac-muted">No review notes recorded.</p>
            )}
          </div>
        )}

        {!readOnly && (
          <>
            <div className="ac-actions">
              <button
                type="button"
                className="ac-btn ac-btn-primary"
                disabled={busy}
                onClick={() => onApprove(approval.id)}
              >
                Approve
              </button>
              <button
                type="button"
                className="ac-btn ac-btn-danger"
                disabled={busy}
                onClick={() => setRejecting((open) => !open)}
                aria-expanded={rejecting}
              >
                Reject
              </button>
            </div>

            <div className={`ac-reject-box${rejecting ? ' is-open' : ''}`}>
              <label className="ac-sr-only" htmlFor={`reject-${approval.id}`}>Rejection reason</label>
              <input
                id={`reject-${approval.id}`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    submitReject()
                  }
                }}
                placeholder="Why is this being rejected?"
              />
              <button
                type="button"
                className="ac-btn ac-btn-danger"
                disabled={busy || !reason.trim()}
                onClick={submitReject}
              >
                Confirm reject
              </button>
            </div>
          </>
        )}
      </div>

      <div className="ac-photo">
        {pickup?.photoUrl ? (
          <img src={pickup.photoUrl} alt={`Photo submitted with ${title}`} />
        ) : (
          <span>
            <Camera size={22} strokeWidth={2} aria-hidden="true" />
            No photo submitted
          </span>
        )}
      </div>
    </article>
  )
}
