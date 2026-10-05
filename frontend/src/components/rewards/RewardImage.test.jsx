import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import RewardImage from './RewardImage'

afterEach(cleanup)

it('falls back on a broken image and recovers when an admin chooses another image', () => {
  const { container, rerender } = render(<RewardImage src="https://example.com/broken.webp" />)
  fireEvent.error(container.querySelector('img'))
  expect(container.querySelector('img')).toBeNull()
  expect(container.querySelector('svg')).toBeTruthy()
  rerender(<RewardImage src="/images/rewards/tote.webp" />)
  expect(container.querySelector('img')).toHaveAttribute('src', '/images/rewards/tote.webp')
})
