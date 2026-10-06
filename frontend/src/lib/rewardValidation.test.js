import { describe, expect, it } from 'vitest'
import { hasErrors, validateAward, validatePointsEntry, validateReview, validateRewardItem } from './rewardValidation'

// These mirror the API's rules, so a mistake is explained next to the field.
const item = (fields = {}) => ({ name: 'Tote bag', pointsCost: 50, stock: '', description: '', imageUrl: '', ...fields })

describe('validateRewardItem', () => {
  it('accepts a complete item with unlimited stock', () => {
    expect(validateRewardItem(item())).toEqual({})
  })

  it('needs a name, and not only spaces', () => {
    expect(validateRewardItem(item({ name: '   ' })).name).toBeDefined()
    expect(validateRewardItem(item({ name: 'x'.repeat(121) })).name).toBeDefined()
  })

  it.each([['', 'empty'], [0, 'zero'], [-3, 'negative'], [2.5, 'a fraction'], [100001, 'over the limit']])(
    'refuses a cost that is %s (%s)', (cost) => {
      expect(validateRewardItem(item({ pointsCost: cost })).pointsCost).toBeDefined()
    })

  it('allows empty stock but not negative or fractional stock', () => {
    expect(validateRewardItem(item({ stock: '' })).stock).toBeUndefined()
    expect(validateRewardItem(item({ stock: 0 })).stock).toBeUndefined()
    expect(validateRewardItem(item({ stock: -1 })).stock).toBeDefined()
    expect(validateRewardItem(item({ stock: 1.5 })).stock).toBeDefined()
  })

  it('limits the description to 500 characters', () => {
    expect(validateRewardItem(item({ description: 'x'.repeat(501) })).description).toBeDefined()
  })

  it('only accepts https image links', () => {
    expect(validateRewardItem(item({ imageUrl: 'https://example.com/tote.webp' })).imageUrl).toBeUndefined()
    expect(validateRewardItem(item({ imageUrl: 'http://example.com/tote.webp' })).imageUrl).toBeDefined()
    expect(validateRewardItem(item({ imageUrl: 'not a link' })).imageUrl).toBeDefined()
  })
})

describe('validatePointsEntry', () => {
  it('accepts a negative correction with a reason', () => {
    expect(validatePointsEntry({ pointsEarned: -5, reason: 'Duplicate award' })).toEqual({})
  })

  it('refuses zero points and a missing reason', () => {
    const errors = validatePointsEntry({ pointsEarned: 0, reason: ' ' })
    expect(errors.pointsEarned).toBeDefined()
    expect(errors.reason).toBeDefined()
  })
})

describe('validateAward', () => {
  it('needs a resident, a pickup, at least one point and a reason', () => {
    const errors = validateAward({ residentId: '', pickupRequestId: '', pointsEarned: 0, reason: '' })
    expect(Object.keys(errors).sort()).toEqual(['pickupRequestId', 'pointsEarned', 'reason', 'residentId'])
  })

  it('accepts a complete award', () => {
    expect(validateAward({ residentId: 'r', pickupRequestId: 'p', pointsEarned: 5, reason: 'Bonus' })).toEqual({})
  })
})

describe('validateReview', () => {
  it('needs a note to decline but not to approve', () => {
    expect(validateReview('reject', '  ').note).toBeDefined()
    expect(validateReview('approve', '')).toEqual({})
  })

  it('limits the note to 500 characters', () => {
    expect(validateReview('approve', 'x'.repeat(501)).note).toBeDefined()
  })
})

it('hasErrors is true only when a field has a message', () => {
  expect(hasErrors({})).toBe(false)
  expect(hasErrors({ name: 'Give the item a name.' })).toBe(true)
})
