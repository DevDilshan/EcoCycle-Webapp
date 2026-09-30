import { formatCompactDate } from '../../lib/adminUi'

export default function ResidentApprovalNotice({ pickup }) {
  if (!pickup?.hasApprovalRequest) return null

  const status = pickup.approvalStatus
  const flagReason = pickup.flagReason?.trim()
  const reviewNotes = pickup.approvalReviewNotes?.trim()
  const reviewedAt = pickup.approvalReviewedAt

  if (status === 'Rejected') {
    return (
      <div className="resident-approval-notice rejected" role="alert">
        <strong>Pickup not approved</strong>
        <p>{reviewNotes || 'This request was reviewed and cannot be scheduled as submitted.'}</p>
        {flagReason && (
          <p className="resident-approval-meta">
            <span>Originally flagged:</span> {flagReason}
          </p>
        )}
        {reviewedAt && (
          <p className="resident-approval-meta">Reviewed {formatCompactDate(reviewedAt)}</p>
        )}
      </div>
    )
  }

  if (status === 'Pending') {
    return (
      <div className="resident-approval-notice pending">
        <strong>Waiting for admin review</strong>
        <p>{flagReason || 'Your pickup was flagged and is waiting for a team decision.'}</p>
      </div>
    )
  }

  if (status === 'Approved' && reviewNotes) {
    return (
      <div className="resident-approval-notice approved">
        <strong>Admin approved your pickup</strong>
        <p>{reviewNotes}</p>
        {reviewedAt && (
          <p className="resident-approval-meta">Reviewed {formatCompactDate(reviewedAt)}</p>
        )}
      </div>
    )
  }

  return null
}
