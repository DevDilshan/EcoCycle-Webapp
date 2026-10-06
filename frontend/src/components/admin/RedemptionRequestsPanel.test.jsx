import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import RedemptionRequestsPanel from './RedemptionRequestsPanel'

const apiRequest = vi.fn()

vi.mock('../../lib/api', () => ({
  formatDate: () => '5 Oct',
  apiRequest: (...args) => apiRequest(...args),
}))

const pending = {
  id: 'req-1', residentName: 'Nimali', residentEmail: 'nimali@test.local', reason: 'Tote bag',
  points: 5, status: 'Pending', delivery: 'Collect', createdAt: '2026-10-05T10:00:00Z',
}
const approved = {
  ...pending, id: 'req-2', status: 'Approved', collectionCode: 'ECO-ABCD-EFGH', fulfilledAt: null,
}

function listOf(items) {
  return { items, page: 1, pageSize: 8, totalCount: items.length, totalPages: 1 }
}

beforeEach(() => {
  apiRequest.mockReset()
})
afterEach(cleanup)

it('shows an empty message when there are no requests', async () => {
  apiRequest.mockResolvedValue(listOf([]))
  render(<RedemptionRequestsPanel />)
  expect(await screen.findByText('No redemption requests match.')).toBeVisible()
})

it('will not decline a request without a reason, and sends nothing', async () => {
  apiRequest.mockResolvedValue(listOf([pending]))
  const user = userEvent.setup()
  render(<RedemptionRequestsPanel />)

  await user.click(await screen.findByRole('button', { name: 'Decline' }))
  const dialogButtons = screen.getAllByRole('button', { name: 'Decline' })
  await user.click(dialogButtons[dialogButtons.length - 1])

  expect(await screen.findByRole('alert')).toHaveTextContent('Tell the resident why the request was declined.')
  expect(apiRequest.mock.calls.some(([path]) => path.includes('/reject'))).toBe(false)
})

it('approves a request, tells the admin, and reloads the list', async () => {
  apiRequest.mockImplementation(async (path) => (path.startsWith('/redemptions?') ? listOf([pending]) : {}))
  const onSuccess = vi.fn()
  const user = userEvent.setup()
  render(<RedemptionRequestsPanel onSuccess={onSuccess} />)

  await user.click(await screen.findByRole('button', { name: 'Approve' }))
  const approveButtons = screen.getAllByRole('button', { name: 'Approve' })
  await user.click(approveButtons[approveButtons.length - 1])

  await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('Redemption approved and points deducted.'))
  const approveCall = apiRequest.mock.calls.find(([path]) => path === '/redemptions/req-1/approve')
  expect(approveCall[1].method).toBe('POST')
  expect(apiRequest.mock.calls.filter(([path]) => path.startsWith('/redemptions?')).length).toBeGreaterThan(1)
})

it('passes an API refusal on to the admin', async () => {
  apiRequest.mockImplementation(async (path) => {
    if (path.startsWith('/redemptions?')) return listOf([pending])
    throw new Error('The resident now has only 2 points, less than the 5 requested.')
  })
  const onError = vi.fn()
  const user = userEvent.setup()
  render(<RedemptionRequestsPanel onError={onError} />)

  await user.click(await screen.findByRole('button', { name: 'Approve' }))
  const approveButtons = screen.getAllByRole('button', { name: 'Approve' })
  await user.click(approveButtons[approveButtons.length - 1])

  await waitFor(() => expect(onError).toHaveBeenCalledWith('The resident now has only 2 points, less than the 5 requested.'))
})

it('records the hand-over of an approved reward', async () => {
  apiRequest.mockImplementation(async (path) => (path.startsWith('/redemptions?') ? listOf([approved]) : {}))
  const user = userEvent.setup()
  render(<RedemptionRequestsPanel />)

  expect(await screen.findByText('ECO-ABCD-EFGH')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Mark collected' }))

  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/redemptions/req-2/fulfil', { method: 'POST' }))
})
