import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// "user" is the same thing as "resident", and an account with no role at all
// (one created through Google sign-in) is a resident too -- the backend maps
// both the same way.
function normalizeRole(role) {
  if (!role) return null
  const normalized = String(role).toLowerCase()
  return normalized === 'user' ? 'resident' : normalized
}

function roleFromToken(accessToken) {
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]))
    return normalizeRole(payload.app_metadata?.role ?? payload.user_metadata?.role)
  } catch {
    return null
  }
}

export function getUserRole(user, session) {
  const fromAppMeta = normalizeRole(user?.app_metadata?.role)
  if (fromAppMeta) return fromAppMeta

  const fromUserMeta = normalizeRole(user?.user_metadata?.role)
  if (fromUserMeta) return fromUserMeta

  if (session?.access_token) {
    const fromToken = roleFromToken(session.access_token)
    if (fromToken) return fromToken
  }

  return 'resident'
}

export function isAdmin(user, session) {
  return getUserRole(user, session) === 'admin'
}
