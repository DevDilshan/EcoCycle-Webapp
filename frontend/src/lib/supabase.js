import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

function normalizeRole(role) {
  return role ? String(role).toLowerCase() : null
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

  return 'user'
}

export function isAdmin(user, session) {
  return getUserRole(user, session) === 'admin'
}
