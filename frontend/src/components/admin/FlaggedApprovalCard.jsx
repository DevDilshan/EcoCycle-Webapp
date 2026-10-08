import { useEffect, useState } from 'react'
import { Calendar, Camera, Flag, MapPin, UserRound } from 'lucide-react'
import { formatCompactDate, formatRequestId, inferCategory } from '../../lib/adminUi'
import AgentInsightPanel from './AgentInsightPanel'
import { notifierResidentDraft } from '../../lib/approvalNotifierDraft'
import {
  RESIDENT_MESSAGE_MAX,
  validateRejectionReason,
} from '../../lib/approvalResidentMessage'
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
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState(null)

  useEffect(() => {
    setReasonError(null)
    setRejecting(false)
    setReason(notifierResidentDraft(detail))
  }, [approval.id])

  useEffect(() => {
    const draft = notifierResidentDraft(detail)
    if (!draft) return
    setReason((prev) => (prev.trim() ? prev : draft))
  }, [detail?.agentInsight?.residentNotification])

  const category =
    detail?.agentInsight?.category || pickup?.category || inferCategory(pickup?.description)
  const title = pickup?.description?.slice(0, 80) || approval.flagReason || 'Flagged pickup request'

  function submitReject() {
    const trimmed = reason.trim()
    const error = validateRejectionReason(trimmed)
    if (error) {
      setReasonError(error)
      return
    }
    setReasonError(null)
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
                <strong>{approval.status === 'Rejected' ? 'Message to resident' : 'Admin notes'}:</strong>{' '}
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
                onClick={() => {
                  setRejecting((open) => {
                    const next = !open
                    if (next) {
                      const draft = notifierResidentDraft(detail)
                      if (draft) {
                        setReason((prev) => (prev.trim() ? prev : draft))
                      }
                    }
                    return next
                  })
                }}
                aria-expanded={rejecting}
              >
                Reject
              </button>
            </div>

            <div className={`ac-reject-box${rejecting ? ' is-open' : ''}${reasonError ? ' has-error' : ''}`}>
              <label htmlFor={`reject-${approval.id}`}>Why is this being rejected?</label>
              <p className="ac-field-hint">
                Pre-filled from the Notifier draft when available. Residents see this on their pickup.
              </p>
              <textarea
                id={`reject-${approval.id}`}
                rows={4}
                maxLength={RESIDENT_MESSAGE_MAX}
                value={reason}
                onChange={(event) => {
                  const next = event.target.value
                  setReason(next)
                  if (reasonError) setReasonError(validateRejectionReason(next))
                }}
                placeholder="Explain clearly what the household should know."
              />
              <div className="ac-reject-meta">
                <span className={reason.length > RESIDENT_MESSAGE_MAX ? 'is-over' : undefined}>
                  {reason.length.toLocaleString()} / {RESIDENT_MESSAGE_MAX.toLocaleString()}
                </span>
              </div>
              {reasonError ? (
                <p className="ac-reject-error" role="alert">
                  {reasonError}
                </p>
              ) : null}
              <button
                type="button"
                className="ac-btn ac-btn-danger"
                disabled={busy || !!validateRejectionReason(reason)}
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
