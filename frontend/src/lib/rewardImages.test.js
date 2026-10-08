import { expect, it } from 'vitest'
import { REWARD_IMAGES, validRewardImage } from './rewardImages'
import { validateRewardItem } from './rewardValidation'

it('accepts bundled artwork and HTTPS images, rejecting unsafe or arbitrary local paths', () => {
  for (const image of REWARD_IMAGES) expect(validRewardImage(image.url)).toBe(true)
  expect(validRewardImage('https://example.com/image.webp')).toBe(true)
  expect(validRewardImage('')).toBe(true)
  for (const value of ['javascript:alert(1)', 'data:image/png;base64,abc', '/other/file.webp',
    '/images/rewards/../private.webp', 'http://example.com/image.webp', 'https://name:secret@example.com/a.webp']) {
    expect(validRewardImage(value)).toBe(false)
    expect(validateRewardItem({ name: 'Test', pointsCost: 5, imageUrl: value }).imageUrl).toBeTruthy()
  }
})
