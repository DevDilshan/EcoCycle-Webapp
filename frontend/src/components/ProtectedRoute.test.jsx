import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Control what useAuth returns so the route guard can be driven through each
// state without a real Supabase session.
const authState = { user: null, role: null, loading: false }
vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}))

const { default: ProtectedRoute } = await import('./ProtectedRoute')

function renderGuard(requiredRole) {
  return render(
    <MemoryRouter initialEntries={['/secret']}>
      <Routes>
        <Route path="/login" element={<p>LOGIN PAGE</p>} />
        <Route
          path="/secret"
          element={
            <ProtectedRoute requiredRole={requiredRole}>
              <p>SECRET CONTENT</p>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  authState.user = null
  authState.role = null
  authState.loading = false
})

describe('ProtectedRoute (protected-route)', () => {
  it('shows a loading state while auth resolves', () => {
    authState.loading = true
    renderGuard()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('redirects an unauthenticated visitor to /login', () => {
    authState.user = null
    renderGuard()
    expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument()
    expect(screen.queryByText('SECRET CONTENT')).not.toBeInTheDocument()
  })

  it('denies access when the role does not match', () => {
    authState.user = { id: '1' }
    authState.role = 'resident'
    renderGuard('admin')
    expect(screen.getByText('Access denied')).toBeInTheDocument()
    expect(screen.queryByText('SECRET CONTENT')).not.toBeInTheDocument()
  })

  it('renders the children for the right role', () => {
    authState.user = { id: '1' }
    authState.role = 'admin'
    renderGuard('admin')
    expect(screen.getByText('SECRET CONTENT')).toBeInTheDocument()
  })

  it('allows any signed-in user when no specific role is required', () => {
    authState.user = { id: '1' }
    authState.role = 'resident'
    renderGuard()
    expect(screen.getByText('SECRET CONTENT')).toBeInTheDocument()
  })
})
