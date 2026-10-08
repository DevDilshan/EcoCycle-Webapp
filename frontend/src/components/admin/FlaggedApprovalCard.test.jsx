import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FlaggedApprovalCard from './FlaggedApprovalCard'

vi.mock('./AgentInsightPanel', () => ({ default: () => <div data-testid="agent-insight" /> }))
vi.mock('./AcPills', () => ({
  AcCategory: () => <span>Category</span>,
  AcStatusPill: ({ label }) => <span>{label || 'Status'}</span>,
}))

const approval = {
  id: 'approval-1',
  pickupRequestId: 'pickup-1',
  flagReason: 'Possible contamination',
  createdAt: '2026-10-01T10:00:00Z',
  status: 'Pending',
}

const notifierDraft =
  'We cannot collect this mix of waste from the curb. Please separate recyclables and try again.'

const detail = {
  agentInsight: {
    residentNotification: notifierDraft,
    category: 'Recyclable',
  },
}

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(cleanup)

describe('FlaggedApprovalCard approvals workflow', () => {
  it('approves without a separate resident message field', async () => {
    const onApprove = vi.fn()
    const user = userEvent.setup()
    render(
      <FlaggedApprovalCard
        approval={approval}
        pickup={{ description: 'Bags by the gate' }}
        busy={false}
        detail={detail}
        onApprove={onApprove}
        onReject={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Approve' }))
    expect(onApprove).toHaveBeenCalledWith('approval-1')
  })

  it('pre-fills reject reason from the notifier draft and validates length', async () => {
    const onReject = vi.fn()
    const user = userEvent.setup()
    render(
      <FlaggedApprovalCard
        approval={approval}
        pickup={{ description: 'Bags by the gate' }}
        busy={false}
        detail={detail}
        onApprove={vi.fn()}
        onReject={onReject}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Reject' }))
    const field = screen.getByLabelText(/Why is this being rejected/i)
    await waitFor(() => expect(field).toHaveValue(notifierDraft))

    await user.clear(field)
    await user.type(field, 'Too short')
    expect(screen.getByRole('button', { name: 'Confirm reject' })).toBeDisabled()
    expect(onReject).not.toHaveBeenCalled()

    await user.clear(field)
    await user.type(field, notifierDraft)
    await user.click(screen.getByRole('button', { name: 'Confirm reject' }))
    await waitFor(() => expect(onReject).toHaveBeenCalledWith('approval-1', notifierDraft))
  })
})
