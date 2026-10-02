import { formatCompactDate } from '../../lib/adminUi'

/**
 * What the review decided, in the resident's own view of their pickup.
 *
 * Three tones on the shared `r-notice` block: red when nothing is coming,
 * amber while a person still has to decide, green once it is through.
 */
export default function ResidentApprovalNotice({ pickup }) {
  if (!pickup?.hasApprovalRequest) return null

  const status = pickup.approvalStatus
  const flagReason = pickup.flagReason?.trim()
  const reviewNotes = pickup.approvalReviewNotes?.trim()
  const reviewedAt = pickup.approvalReviewedAt

  if (status === 'Rejected') {
    return (
      <div className="r-notice is-bad" role="alert">
        <strong>Pickup not approved</strong>
        <p>{reviewNotes || 'This request was reviewed and cannot be scheduled as submitted.'}</p>
        {flagReason && <p>Originally flagged: {flagReason}</p>}
        {reviewedAt && <p>Reviewed {formatCompactDate(reviewedAt)}</p>}
      </div>
    )
  }

  if (status === 'Pending') {
    return (
      <div className="r-notice is-warn">
        <strong>Waiting for admin review</strong>
        <p>{flagReason || 'Your pickup was flagged and is waiting for a team decision.'}</p>
      </div>
    )
  }

  if (status === 'Approved' && reviewNotes) {
    return (
      <div className="r-notice is-info">
        <strong>Admin approved your pickup</strong>
        <p>{reviewNotes}</p>
        {reviewedAt && <p>Reviewed {formatCompactDate(reviewedAt)}</p>}
      </div>
    )
  }

  return null
}
