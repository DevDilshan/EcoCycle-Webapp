import { afterEach, describe, expect, it, vi } from 'vitest'

// Give apiRequest a signed-in session so it reaches the fetch call. The real
// module pulls the token from Supabase; here it is always present.
vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'test-token' } } }),
    },
  },
}))

const { apiRequest, apiUrl } = await import('./api')

function mockFetch(response) {
  global.fetch = vi.fn().mockResolvedValue(response)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('apiUrl', () => {
  it('prefixes /api and normalises the leading slash', () => {
    // Base-URL-agnostic: base is empty locally (Vite proxy) but set in a
    // configured/deployed build, so assert the /api suffix either way.
    expect(apiUrl('/pickuprequests')).toMatch(/\/api\/pickuprequests$/)
    expect(apiUrl('pickuprequests')).toMatch(/\/api\/pickuprequests$/)
  })
})

describe('apiRequest (API integration)', () => {
  it('returns the parsed JSON body on success', async () => {
    mockFetch({ ok: true, status: 200, json: async () => ({ id: 'abc' }) })

    const result = await apiRequest('/pickuprequests/abc')

    expect(result).toEqual({ id: 'abc' })
    expect(global.fetch).toHaveBeenCalledOnce()
  })

  it('sends the bearer token and JSON content-type for a body', async () => {
    mockFetch({ ok: true, status: 201, json: async () => ({}) })

    await apiRequest('/pickuprequests', { method: 'POST', body: JSON.stringify({ x: 1 }) })

    const [, options] = global.fetch.mock.calls[0]
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(options.headers['Content-Type']).toBe('application/json')
  })

  it('returns null for 204 No Content', async () => {
    mockFetch({ ok: true, status: 204, json: async () => ({}) })
    expect(await apiRequest('/pickuprequests/abc', { method: 'DELETE' })).toBeNull()
  })
})

describe('apiRequest error handling (error-state)', () => {
  it('throws with the server message and exposes the status', async () => {
    mockFetch({ ok: false, status: 400, json: async () => ({ message: 'That zone is not active.' }) })

    const error = await apiRequest('/pickuprequests', { method: 'POST' }).catch((e) => e)

    expect(error.message).toBe('That zone is not active.')
    expect(error.status).toBe(400)
  })

  it('falls back to the first field error when there is no top-level message', async () => {
    // ASP.NET ValidationProblemDetails: { errors: { field: ["msg"] } }. Without
    // the fallback, callers would show the generic "One or more validation
    // errors occurred." instead of the real reason.
    mockFetch({
      ok: false,
      status: 400,
      json: async () => ({
        errors: { contactPhone: ['Please give a valid contact number, e.g. 0771234567.'] },
      }),
    })

    const error = await apiRequest('/pickuprequests', { method: 'POST' }).catch((e) => e)

    expect(error.message).toBe('Please give a valid contact number, e.g. 0771234567.')
    expect(error.details).toEqual({ contactPhone: ['Please give a valid contact number, e.g. 0771234567.'] })
  })

  it('falls back to a generic message when the body is empty', async () => {
    mockFetch({ ok: false, status: 500, json: async () => ({}) })

    const error = await apiRequest('/pickuprequests').catch((e) => e)

    expect(error.message).toBe('Request failed (500)')
    expect(error.status).toBe(500)
  })
})
