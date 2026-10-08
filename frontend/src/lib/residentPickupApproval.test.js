import { describe, expect, it } from 'vitest'
import {
  residentApprovalNotice,
  residentListStatusLabel,
  residentPickupStatusPillKey,
} from './residentPickupApproval'

const base = {
  hasApprovalRequest: true,
  status: 'Classified',
}

describe('residentApprovalNotice', () => {
  it('prefers residentMessage on rejected pickups', () => {
    const notice = residentApprovalNotice({
      ...base,
      approvalStatus: 'Rejected',
      residentMessage: 'We cannot collect hazardous items from the curb.',
      approvalReviewNotes: 'Internal note',
    })
    expect(notice?.variant).toBe('rejected')
    expect(notice?.body).toBe('We cannot collect hazardous items from the curb.')
  })

  it('shows pending flag reason while in review', () => {
    const notice = residentApprovalNotice({
      ...base,
      approvalStatus: 'Pending',
      flagReason: 'Bulk limit reached',
    })
    expect(notice?.title).toBe('Waiting for admin review')
    expect(notice?.body).toBe('Bulk limit reached')
  })
})

describe('residentPickupStatusPillKey', () => {
  it('shows Rejected when approval was rejected even if pickup status is Classified', () => {
    expect(
      residentPickupStatusPillKey({
        ...base,
        approvalStatus: 'Rejected',
      }),
    ).toBe('Rejected')
    expect(residentListStatusLabel({ ...base, approvalStatus: 'Rejected' })).toBe('Not approved')
  })
})
