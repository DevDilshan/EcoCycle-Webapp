import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import MyRedemptions from './MyRedemptions'

const request = vi.hoisted(() => vi.fn(async path => path.startsWith('/redemptions') ? { items: [] } : {
  items: [
    { id: 'tote', name: 'Tote bag', pointsCost: 5, stock: 2, imageUrl: '/images/rewards/tote.webp' },
    { id: 'bottle', name: 'Water bottle', pointsCost: 50, stock: 1, imageUrl: '/images/rewards/water-bottle.webp' },
    { id: 'seeds', name: 'Seeds', pointsCost: 10, stock: 0, imageUrl: '/images/rewards/herb-seeds.webp' },
  ],
}))
vi.mock('../../lib/api', () => ({ apiRequest: request, formatDate: () => 'Today' }))
afterEach(cleanup)

it('shows image choices while enforcing stock and available points before sending the chosen ID', async () => {
  render(<MyRedemptions balance={12} canRequest showForm />)
  const tote = await screen.findByRole('radio', { name: 'Tote bag' })
  expect(tote).toBeEnabled()
  expect(screen.getByRole('radio', { name: 'Water bottle' })).toBeDisabled()
  expect(screen.getByRole('radio', { name: 'Seeds' })).toBeDisabled()
  expect(screen.getByText('38 more points needed')).toBeVisible()
  expect(screen.getByText('Sold out')).toBeVisible()
  expect(document.querySelector('img[src="/images/rewards/tote.webp"]')).toBeTruthy()
  fireEvent.click(tote)
  fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
  await vi.waitFor(() => expect(request).toHaveBeenCalledWith('/redemptions', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ rewardItemId: 'tote', deliveryAddress: null }),
  })))
})
