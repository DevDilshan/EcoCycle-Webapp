import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

const auth = vi.hoisted(() => ({
  listener: null,
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  getUser: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  getUserRole: user => user?.app_metadata?.role ?? 'resident',
  supabase: { auth: {
    getSession: auth.getSession,
    refreshSession: auth.refreshSession,
    getUser: auth.getUser,
    onAuthStateChange: callback => {
      auth.listener = callback
      return { data: { subscription: { unsubscribe: auth.unsubscribe } } }
    },
  } },
}))

const residentSession = { user: { id: 'resident', app_metadata: { role: 'resident' } } }

function SessionStatus() {
  const { loading, user, role } = useAuth()
  return <p>{loading ? 'Loading' : user ? `${user.id}:${role}` : 'Signed out'}</p>
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.listener = null
  auth.getSession.mockResolvedValue({ data: { session: residentSession } })
})
afterEach(cleanup)

describe('AuthProvider session lifecycle', () => {
  it('restores the initial session without starting another token refresh', async () => {
    render(<AuthProvider><SessionStatus /></AuthProvider>)
    expect(await screen.findByText('resident:resident')).toBeInTheDocument()
    expect(auth.refreshSession).not.toHaveBeenCalled()
  })

  it('applies refreshed sessions synchronously without recursive auth calls', async () => {
    render(<AuthProvider><SessionStatus /></AuthProvider>)
    await screen.findByText('resident:resident')
    act(() => auth.listener('TOKEN_REFRESHED', {
      user: { id: 'collector', app_metadata: { role: 'collector' } },
    }))
    expect(screen.getByText('collector:collector')).toBeInTheDocument()
    expect(auth.refreshSession).not.toHaveBeenCalled()
    expect(auth.getUser).not.toHaveBeenCalled()
    act(() => auth.listener('SIGNED_OUT', null))
    expect(screen.getByText('Signed out')).toBeInTheDocument()
  })

  it('does not resurrect a signed-out user when the initial read finishes late', async () => {
    let resolveInitial
    auth.getSession.mockReturnValue(new Promise(resolve => { resolveInitial = resolve }))
    render(<AuthProvider><SessionStatus /></AuthProvider>)
    act(() => auth.listener('SIGNED_OUT', null))
    await act(async () => resolveInitial({ data: { session: residentSession } }))
    expect(screen.getByText('Signed out')).toBeInTheDocument()
  })

  it('unsubscribes when the provider unmounts', () => {
    const view = render(<AuthProvider><SessionStatus /></AuthProvider>)
    view.unmount()
    expect(auth.unsubscribe).toHaveBeenCalledOnce()
  })
})
