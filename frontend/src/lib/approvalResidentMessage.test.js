import { describe, expect, it } from 'vitest'
import {
  RESIDENT_MESSAGE_MAX,
  RESIDENT_MESSAGE_MIN,
  validateRejectionReason,
} from './approvalResidentMessage'

describe('validateRejectionReason', () => {
  it('requires non-empty text', () => {
    expect(validateRejectionReason('')).toMatch(/Explain why/)
    expect(validateRejectionReason('   ')).toMatch(/Explain why/)
  })

  it(`requires at least ${RESIDENT_MESSAGE_MIN} characters`, () => {
    expect(validateRejectionReason('Too short')).toMatch(/at least/)
  })

  it(`rejects text over ${RESIDENT_MESSAGE_MAX} characters`, () => {
    expect(validateRejectionReason('x'.repeat(RESIDENT_MESSAGE_MAX + 1))).toMatch(/under/)
  })

  it('accepts a clear household-facing message', () => {
    const ok = 'This pickup cannot be approved as submitted. Please contact support for help.'
    expect(validateRejectionReason(ok)).toBeNull()
  })
})
