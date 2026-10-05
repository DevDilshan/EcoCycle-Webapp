import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import RewardImagePicker from './RewardImagePicker'

const api = vi.hoisted(() => vi.fn(async () => ({ imageUrl: 'https://example.com/upload.webp' })))
vi.mock('../../lib/api', () => ({ apiRequest: api }))
afterEach(() => { cleanup(); api.mockClear() })

it('lets an admin remove the current image explicitly', () => {
  const onChange = vi.fn()
  render(<RewardImagePicker value="/images/rewards/tote.webp" onChange={onChange} />)
  fireEvent.click(screen.getByRole('button', { name: 'Remove image', exact: true }))
  expect(onChange).toHaveBeenCalledWith('')
})

it('cancels an in-progress upload without replacing the previous image', async () => {
  api.mockImplementationOnce((_path, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')))
  }))
  const onChange = vi.fn(), onBusyChange = vi.fn()
  render(<RewardImagePicker value="/images/rewards/tote.webp" onChange={onChange} onBusyChange={onBusyChange} />)
  fireEvent.click(screen.getByRole('button', { name: 'Upload image', exact: true }))
  fireEvent.change(screen.getByLabelText('Upload reward image'), { target: { files: [new File(['image'], 'tote.webp', { type: 'image/webp' })] } })
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel upload', exact: true }))
  await vi.waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false))
  expect(onChange).not.toHaveBeenCalled()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('uploads a chosen file as multipart, returns the stored image URL and releases the save button', async () => {
  const onChange = vi.fn(), onBusyChange = vi.fn()
  render(<RewardImagePicker value="" onChange={onChange} onBusyChange={onBusyChange} />)
  fireEvent.click(screen.getByRole('button', { name: 'Upload image', exact: true }))
  const file = new File(['image'], 'tote.webp', { type: 'image/webp' })
  fireEvent.change(screen.getByLabelText('Upload reward image'), { target: { files: [file] } })
  await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith('https://example.com/upload.webp'))
  expect(api).toHaveBeenCalledWith('/reward-items/image', expect.objectContaining({ method: 'POST', body: expect.any(FormData) }))
  expect(onBusyChange.mock.calls).toEqual([[true], [false]])
})

it('rejects a non-image without uploading and supports gallery and URL choices with matching descriptions', async () => {
  const onChange = vi.fn()
  render(<RewardImagePicker value="" onChange={onChange} />)
  fireEvent.click(screen.getByRole('button', { name: 'Use Tote bag image' }))
  expect(onChange).toHaveBeenCalledWith('/images/rewards/tote.webp')
  expect(screen.queryByRole('button', { name: 'Use suggested image' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Image URL', exact: true }))
  fireEvent.change(screen.getByLabelText('Image URL'), { target: { value: 'https://example.com/custom.webp' } })
  expect(onChange).toHaveBeenCalledWith('https://example.com/custom.webp')
  expect(screen.getByText(/Paste a public HTTPS image link/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Upload image', exact: true }))
  fireEvent.change(screen.getByLabelText('Upload reward image'), { target: { files: [new File(['svg'], 'image.svg', { type: 'image/svg+xml' })] } })
  expect(await screen.findByRole('alert')).toHaveTextContent('JPEG, PNG or WebP')
  expect(api).not.toHaveBeenCalled()
})
