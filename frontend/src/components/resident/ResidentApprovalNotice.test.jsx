import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ResidentApprovalNotice from './ResidentApprovalNotice'

describe('ResidentApprovalNotice', () => {
  it('shows residentMessage when a flagged pickup was rejected', () => {
    render(
      <ResidentApprovalNotice
        pickup={{
          hasApprovalRequest: true,
          approvalStatus: 'Rejected',
          residentMessage: 'This request cannot be scheduled as submitted.',
          approvalReviewNotes: 'Admin shorthand',
        }}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Pickup not approved')
    expect(screen.getByText('This request cannot be scheduled as submitted.')).toBeInTheDocument()
    expect(screen.queryByText('Admin shorthand')).not.toBeInTheDocument()
  })

  it('renders nothing without an approval request', () => {
    const { container } = render(<ResidentApprovalNotice pickup={{ hasApprovalRequest: false }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
