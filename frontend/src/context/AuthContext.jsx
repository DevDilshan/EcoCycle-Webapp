import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, getUserRole } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password }).then((result) => {
      if (result.data.session) setSession(result.data.session)
      return result
    })

  const signUp = (email, password, role = 'user') =>
    supabase.auth.signUp({
      email,
      password,
      options: { data: { role } },
    })

  const signOut = () => supabase.auth.signOut()

  const user = session?.user ?? null
  const role = getUserRole(user)

  return (
    <AuthContext.Provider value={{ session, user, role, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
