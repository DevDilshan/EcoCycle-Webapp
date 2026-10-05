import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

// --- Mocks ---------------------------------------------------------------
// The page fetches zones, the bulky allowance and the request list on mount.
// Return harmless shapes so it renders; the create POST must never be reached
// when validation fails, which these tests assert.
const apiRequest = vi.fn(async (path) => {
  if (path.startsWith('/zones')) return []
  if (path.includes('bulk-allowance')) return { remaining: 2, limit: 2 }
  if (path.startsWith('/pickuprequests?')) return { items: [], totalCount: 0, page: 1, pageSize: 10 }
  return {}
})
vi.mock('../../lib/api', () => ({
  apiRequest: (...args) => apiRequest(...args),
  apiUrl: (p) => `/api${p}`,
}))
vi.mock('../../lib/pickupPhoto', () => ({ uploadPickupPhoto: vi.fn() }))
// react-leaflet needs a real browser; stub the map picker out.
vi.mock('../../components/map/PickupLocationPicker', () => ({ default: () => null }))
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ role: 'resident', user: { id: 'resident-1' } }),
}))

const { default: PickupsPage } = await import('./PickupsPage')

function renderPage() {
  return render(
    <MemoryRouter>
      <PickupsPage />
    </MemoryRouter>,
  )
}

afterEach(() => {
  apiRequest.mockClear()
})

describe('PickupsPage create form (component + form-validation)', () => {
  it('shows inline validation errors and does not submit an empty form', async () => {
    renderPage()

    // The form is collapsed by default; open it.
    fireEvent.click(await screen.findByRole('button', { name: /New pickup/i }))

    // Submit with everything blank.
    fireEvent.click(screen.getByRole('button', { name: 'Submit request' }))

    expect(await screen.findByText('Please describe the waste to be collected.')).toBeInTheDocument()
    expect(screen.getByText('Please choose the zone this pickup is in.')).toBeInTheDocument()
    expect(screen.getByText('Please give a number the crew can call.')).toBeInTheDocument()
    expect(
      screen.getByText('Please add a photo of the waste so it can be classified.'),
    ).toBeInTheDocument()

    // Client-side gate: the create endpoint is never called.
    const createCalls = apiRequest.mock.calls.filter(
      ([path, opts]) => path === '/pickuprequests' && opts?.method === 'POST',
    )
    expect(createCalls).toHaveLength(0)
  })

  it('shows the error message when loading the list fails (error-state)', async () => {
    // Reject only the main list load (pageSize=20); the per-chip count fetches
    // (pageSize=1) and the zone/allowance fetches still resolve, so the only
    // failure under test is the list the page shows.
    apiRequest.mockImplementation(async (path) => {
      if (path.startsWith('/pickuprequests?') && path.includes('pageSize=20')) {
        throw new Error('Could not load your pickups. Please try again.')
      }
      if (path.startsWith('/pickuprequests?')) return { items: [], totalCount: 0 }
      if (path.startsWith('/zones')) return []
      if (path.includes('bulk-allowance')) return { remaining: 2, limit: 2 }
      return {}
    })

    renderPage()

    expect(
      await screen.findByText('Could not load your pickups. Please try again.'),
    ).toBeInTheDocument()
  })
})
