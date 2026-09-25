import { supabase } from './supabase'

async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Not authenticated. Please sign in again.')
  }
  return session.access_token
}

export async function apiRequest(path, options = {}) {
  const token = await getAccessToken()
  const headers = {
    Authorization: `Bearer ${token}`,
    ...options.headers,
  }

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`/api${path}`, { ...options, headers })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const message = body.message
      || (body.errors && JSON.stringify(body.errors))
      || body.title
      || `Request failed (${response.status})`
    throw new Error(message)
  }

  if (response.status === 204) return null
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
