import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'

const apiRequest = vi.fn()
vi.mock('../../lib/api', () => ({ apiRequest: (...args) => apiRequest(...args), formatDate: () => '' }))
vi.mock('../../hooks/useAdminCatalog', () => ({
  useAdminCatalog: () => ({ pickups: [], zones: [], profileMap: new Map(), refresh: vi.fn() }),
}))
vi.mock('../../components/admin/ZoneMap', () => ({ default: () => <div>Zone map</div> }))

const { default: DashboardPage } = await import('./DashboardPage')
afterEach(() => {
  vi.resetAllMocks()
  vi.useRealTimers()
})

it('keeps failed totals out of the dashboard and allows a successful retry', async () => {
  apiRequest.mockRejectedValue(new Error('Database unavailable'))
  render(<MemoryRouter><DashboardPage /></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable')
  expect(screen.queryByText('Requests today')).not.toBeInTheDocument()

  apiRequest.mockResolvedValue({ items: [], totalCount: 6 })
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('Requests today')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('ends a stalled load with a retry state after twenty seconds', async () => {
  vi.useFakeTimers()
  apiRequest.mockImplementation((_path, options) => options?.signal
    ? new Promise((_resolve, reject) => options.signal.addEventListener('abort',
      () => reject(new DOMException('Aborted', 'AbortError')), { once: true }))
    : Promise.resolve([]))
  render(<MemoryRouter><DashboardPage /></MemoryRouter>)
  expect(screen.getByText('Loading dashboard…')).toBeInTheDocument()
  await act(() => vi.advanceTimersByTimeAsync(20000))
  expect(screen.getByRole('alert')).toHaveTextContent('took too long to respond')
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  expect(screen.queryByText('Requests today')).not.toBeInTheDocument()
})
