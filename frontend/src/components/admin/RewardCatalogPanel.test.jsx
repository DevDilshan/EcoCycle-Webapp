import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import RewardCatalogPanel from './RewardCatalogPanel'

const apiRequest = vi.fn()
const confirm = vi.fn()

vi.mock('../../lib/api', () => ({ apiRequest: (...args) => apiRequest(...args) }))
vi.mock('../../hooks/useConfirm', () => ({ useConfirm: () => [null, confirm] }))
// The picture picker has its own tests; here it only needs to exist.
vi.mock('../rewards/RewardImagePicker', () => ({ default: () => null }))
vi.mock('../rewards/RewardImage', () => ({ default: () => null }))

const tote = { id: 'item-1', name: 'Tote bag', pointsCost: 5, stock: 10, isActive: true, delivery: 'Collect' }

function catalogOf(items) {
  return { items, page: 1, pageSize: 8, totalCount: items.length, totalPages: 1 }
}

beforeEach(() => {
  apiRequest.mockReset()
  confirm.mockReset()
})
afterEach(cleanup)

it('shows the empty-catalog message', async () => {
  apiRequest.mockResolvedValue(catalogOf([]))
  render(<RewardCatalogPanel />)
  expect(await screen.findByText(/No reward items yet/)).toBeVisible()
})

it('explains bad fields next to them and does not save', async () => {
  apiRequest.mockResolvedValue(catalogOf([]))
  const user = userEvent.setup()
  render(<RewardCatalogPanel />)

  await user.click(await screen.findByRole('button', { name: 'Add item' }))
  const cost = screen.getByLabelText('Points cost')
  await user.clear(cost)
  await user.type(cost, '0')
  const addButtons = screen.getAllByRole('button', { name: 'Add item' })
  await user.click(addButtons[addButtons.length - 1])

  expect(await screen.findByText('Give the item a name.')).toBeVisible()
  expect(screen.getByText('The cost must be at least 1 point.')).toBeVisible()
  expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
})

it('adds an item with empty stock sent as unlimited', async () => {
  apiRequest.mockImplementation(async (path, options) => (options ? {} : catalogOf([])))
  const onSuccess = vi.fn()
  const user = userEvent.setup()
  render(<RewardCatalogPanel onSuccess={onSuccess} />)

  await user.click(await screen.findByRole('button', { name: 'Add item' }))
  await user.type(screen.getByLabelText('Name'), '  Seed packet  ')
  const cost = screen.getByLabelText('Points cost')
  await user.clear(cost)
  await user.type(cost, '10')
  const addButtons = screen.getAllByRole('button', { name: 'Add item' })
  await user.click(addButtons[addButtons.length - 1])

  await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('Reward item added.'))
  const [path, options] = apiRequest.mock.calls.find(([, o]) => o?.method === 'POST')
  expect(path).toBe('/reward-items')
  expect(JSON.parse(options.body)).toMatchObject({ name: 'Seed packet', pointsCost: 10, stock: null, isActive: true })
})

it('does not delete when the admin cancels the confirmation', async () => {
  apiRequest.mockResolvedValue(catalogOf([tote]))
  confirm.mockResolvedValue(false)
  const user = userEvent.setup()
  render(<RewardCatalogPanel />)

  await user.click(await screen.findByRole('button', { name: 'Delete' }))

  expect(confirm).toHaveBeenCalled()
  expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false)
})

it('shows why the API refused a delete', async () => {
  apiRequest.mockImplementation(async (path, options) => {
    if (options?.method === 'DELETE') throw new Error('This item has pending redemption requests.')
    return catalogOf([tote])
  })
  confirm.mockResolvedValue(true)
  const onError = vi.fn()
  const user = userEvent.setup()
  render(<RewardCatalogPanel onError={onError} />)

  await user.click(await screen.findByRole('button', { name: 'Delete' }))

  await waitFor(() => expect(onError).toHaveBeenCalledWith('This item has pending redemption requests.'))
})
