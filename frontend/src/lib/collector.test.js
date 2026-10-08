import { describe, expect, it } from 'vitest'
import { formatCompletionStatus, isRoutePending } from './collector'

describe('collector route completion labels', () => {
  it('maps numeric and string API values', () => {
    expect(formatCompletionStatus(0)).toBe('Pending')
    expect(formatCompletionStatus(1)).toBe('Completed')
    expect(formatCompletionStatus(2)).toBe('Missed')
    expect(formatCompletionStatus('Completed')).toBe('Completed')
  })

  it('knows which stops can still be acted on', () => {
    expect(isRoutePending(0)).toBe(true)
    expect(isRoutePending('Pending')).toBe(true)
    expect(isRoutePending(1)).toBe(false)
    expect(isRoutePending(2)).toBe(false)
  })
})
