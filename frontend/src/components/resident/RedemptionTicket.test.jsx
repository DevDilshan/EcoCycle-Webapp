import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import RedemptionTicket from './RedemptionTicket'
import { addressError, redemptionStatusLabel } from '../../lib/redemption'

afterEach(cleanup)

const approved = {
  status: 'Approved', delivery: 'Collect', collectionCode: 'ECO-7F3K-92QD',
  deliveryInstructions: 'Counter 3, Town Hall.',
}

it('shows the code and where to collect once a request is approved', () => {
  render(<RedemptionTicket item={approved} />)
  expect(screen.getByText('ECO-7F3K-92QD')).toBeVisible()
  expect(screen.getByText('Counter 3, Town Hall.')).toBeVisible()
  expect(redemptionStatusLabel(approved)).toBe('Ready to collect')
})

it('says where an emailed or posted reward is going', () => {
  const emailed = { ...approved, delivery: 'Email', residentEmail: 'res@test.com' }
  const posted = { ...approved, delivery: 'Post', deliveryAddress: '12 Galle Road, Colombo 03' }
  render(<RedemptionTicket item={emailed} />)
  expect(screen.getByText('To: res@test.com')).toBeVisible()
  expect(redemptionStatusLabel(emailed)).toBe('Being emailed')
  cleanup()
  render(<RedemptionTicket item={posted} />)
  expect(screen.getByText('To: 12 Galle Road, Colombo 03')).toBeVisible()
  expect(redemptionStatusLabel({ ...posted, fulfilledAt: '2026-10-01T09:30:00Z' })).toBe('Posted')
})

it('turns into a receipt after the hand-over and offers nothing to copy', () => {
  const collected = { ...approved, fulfilledAt: '2026-10-01T09:30:00Z' }
  render(<RedemptionTicket item={collected} />)
  expect(screen.getByText(/Collected on/)).toBeVisible()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(redemptionStatusLabel(collected)).toBe('Collected')
})

it('shows nothing for pending, rejected or pre-code approvals', () => {
  for (const item of [{ status: 'Pending' }, { status: 'Rejected' }, { status: 'Approved' }]) {
    const { container } = render(<RedemptionTicket item={item} />)
    expect(container).toBeEmptyDOMElement()
    expect(redemptionStatusLabel(item)).toBe(item.status)
    cleanup()
  }
})

it('asks for an address only when the reward is posted', () => {
  expect(addressError({ delivery: 'Collect' }, '')).toBeNull()
  expect(addressError({ delivery: 'Email' }, '')).toBeNull()
  expect(addressError({ delivery: 'Post' }, 'No 5')).toMatch(/full address/)
  expect(addressError({ delivery: 'Post' }, '12 Galle Road, Colombo 03')).toBeNull()
})
