import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import MyRedemptions from './MyRedemptions'

vi.mock('../../lib/api', () => ({
  formatDate: () => 'Today',
  apiRequest: async path => path.startsWith('/redemptions') ? {
    items: ['Pending', 'Approved', 'Rejected'].map(status => ({
      id: status, status, reason: `Test reward ${status}`, points: 3,
      createdAt: '2026-10-05T12:00:00Z', rewardItemId: 'test-item',
    })),
  } : { items: [] },
}))

afterEach(cleanup)

it('shows the actual redemption decision and permits changes only while pending', async () => {
  render(<MyRedemptions balance={20} canRequest showForm={false} />)
  expect(await screen.findByText('Approved', { exact: true })).toBeVisible()
  expect(screen.getByText('Rejected', { exact: true })).toBeVisible()
  expect(screen.getByText('Pending', { exact: true })).toBeVisible()
  expect(screen.queryByText('Awaiting approval')).not.toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Change' })).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: 'Cancel', exact: true })).toHaveLength(1)
})
