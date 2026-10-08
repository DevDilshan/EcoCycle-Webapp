import { describe, expect, it } from 'vitest'
import { notifierResidentDraft } from './approvalNotifierDraft'

describe('notifierResidentDraft', () => {
  it('returns trimmed resident notification from approval detail', () => {
    const detail = {
      agentInsight: {
        residentNotification: '  Your items will be collected on the next round.  ',
      },
    }
    expect(notifierResidentDraft(detail)).toBe('Your items will be collected on the next round.')
  })

  it('returns empty string when missing', () => {
    expect(notifierResidentDraft(null)).toBe('')
    expect(notifierResidentDraft({ agentInsight: {} })).toBe('')
  })
})
