import { afterEach, expect, it, vi } from 'vitest'
import { apiRequest } from './api'

vi.mock('./supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) } } }))
afterEach(() => vi.unstubAllGlobals())

it('lets the browser set multipart boundaries while keeping JSON request headers unchanged', async () => {
  const fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }))
  vi.stubGlobal('fetch', fetch)
  const multipart = new FormData()
  multipart.append('file', new File(['test'], 'test.webp'))
  await apiRequest('/reward-items/image', { method: 'POST', body: multipart })
  expect(fetch.mock.calls[0][1].headers['Content-Type']).toBeUndefined()
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token')
  await apiRequest('/reward-items', { method: 'POST', body: '{}' })
  expect(fetch.mock.calls[1][1].headers['Content-Type']).toBe('application/json')
})
