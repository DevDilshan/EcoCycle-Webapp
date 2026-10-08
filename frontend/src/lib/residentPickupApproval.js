/** Resident-facing copy for flagged pickup / approval outcomes. */
export function residentApprovalNotice(pickup) {
  if (!pickup?.hasApprovalRequest) return null

  const status = pickup.approvalStatus
  const flagReason = pickup.flagReason?.trim()
  const reviewNotes = pickup.approvalReviewNotes?.trim()
  const residentMessage = pickup.residentMessage?.trim()

  if (status === 'Rejected') {
    return {
      variant: 'rejected',
      title: 'Pickup not approved',
      body:
        residentMessage
        || reviewNotes
        || 'This request was reviewed and cannot be scheduled as submitted.',
      flagReason,
      reviewedAt: pickup.approvalReviewedAt,
    }
  }

  if (status === 'Pending') {
    return {
      variant: 'pending',
      title: 'Waiting for admin review',
      body:
        flagReason
        || 'Your pickup was flagged and is waiting for a team decision.',
      flagReason: null,
      reviewedAt: null,
    }
  }

  if (status === 'Approved') {
    return {
      variant: 'approved',
      title: 'Admin approved your pickup',
      body: reviewNotes || 'Your request passed review and is being scheduled.',
      flagReason: null,
      reviewedAt: pickup.approvalReviewedAt,
    }
  }

  return null
}

export function residentListStatusLabel(pickup) {
  const notice = residentApprovalNotice(pickup)
  if (notice?.variant === 'rejected') return 'Not approved'
  if (notice?.variant === 'pending') return 'In review'
  if (notice?.variant === 'approved' && pickup.status === 'Classified') return 'Approved'
  return pickup.status
}

/** Key for PickupStatusPill — approval outcome overrides raw pickup.status (e.g. Classified + Rejected). */
export function residentPickupStatusPillKey(pickup) {
  if (!pickup) return 'Pending'
  const listStatus = residentListStatusLabel(pickup)
  if (listStatus === 'Not approved') return 'Rejected'
  if (listStatus === 'In review') return 'In review'
  return pickup.status || 'Pending'
}
