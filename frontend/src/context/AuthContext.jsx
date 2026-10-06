import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, getUserRole } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    let authEventReceived = false
    // Supabase manages token refresh. Refreshing inside this listener can
    // recursively emit TOKEN_REFRESHED and stall subsequent auth operations.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      authEventReceived = true
      setSession(nextSession)
      setLoading(false)
    })

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      // A delayed initial read must not restore a session after SIGNED_OUT.
      if (!active || authEventReceived) return
      setSession(initialSession)
      setLoading(false)
    }).catch(() => {
      if (!active || authEventReceived) return
      setSession(null)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password }).then((result) => {
      if (result.data.session) setSession(result.data.session)
      return result
    })

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login` },
    })

  const signUp = (email, password, role = 'resident') =>
    supabase.auth.signUp({
      email,
      password,
      options: { data: { role } },
    })

  const signOut = () => supabase.auth.signOut()

  const updatePassword = (password) => supabase.auth.updateUser({ password })

  const sendPasswordResetEmail = (email) =>
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

  const user = session?.user ?? null
  const role = getUserRole(user, session)

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        role,
        loading,
        signIn,
        signInWithGoogle,
        signUp,
        signOut,
        updatePassword,
        sendPasswordResetEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
