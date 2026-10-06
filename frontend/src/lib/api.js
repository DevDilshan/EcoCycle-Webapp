import { supabase } from './supabase'

/** Empty in dev uses same-origin `/api` (Vite proxy). Set to backend origin in production. */
const apiOrigin = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export function apiUrl(path) {
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${apiOrigin}/api${suffix}`
}

async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Not authenticated. Please sign in again.')
  }
  return session.access_token
}

// Pick the first human-readable message out of an ASP.NET ValidationProblemDetails
// `errors` object ({ field: ["msg", ...] }), so callers that only read error.message
// still see the actual reason instead of the generic "One or more validation errors…".
function firstErrorMessage(errors) {
  if (!errors || typeof errors !== 'object') return null
  for (const value of Object.values(errors)) {
    if (Array.isArray(value) && value.length > 0) return value[0]
    if (typeof value === 'string' && value) return value
  }
  return null
}

export async function apiRequest(path, options = {}) {
  const token = await getAccessToken()
  const headers = {
    Authorization: `Bearer ${token}`,
    ...options.headers,
  }

  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(apiUrl(path), { ...options, headers })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const message = body.message
      || firstErrorMessage(body.errors)
      || body.title
      || `Request failed (${response.status})`
    const error = new Error(message)
    error.status = response.status
    error.details = body.errors || null   // ASP.NET ValidationProblemDetails field errors
    throw error
  }

  if (response.status === 204) return null
  return response.json()
}

/**
 * Fetch an endpoint that does not require a session.
 *
 * `apiRequest` always asks Supabase for an access token and throws when there
 * is none, which is right for the app but wrong for the public landing page:
 * a visitor who has never signed in would see an error instead of the map.
 */
export async function publicRequest(path) {
  const response = await fetch(apiUrl(path), {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }
  return response.json()
}

export function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

export function shortId(value) {
  if (!value) return '—'
  return String(value).slice(0, 8) + '…'
}
