/** Matches PickupRequests.ResidentMessage and RejectApprovalDto limits. */
export const RESIDENT_MESSAGE_MIN = 10
export const RESIDENT_MESSAGE_MAX = 1000

/**
 * Rejection reason is shown to the resident as-is after reject.
 * @param {string} reason
 * @returns {string|null} first error message, or null if valid
 */
export function validateRejectionReason(reason) {
  const text = (reason ?? '').trim()
  if (!text) {
    return 'Explain why this request is being rejected.'
  }
  if (text.length < RESIDENT_MESSAGE_MIN) {
    return `Use at least ${RESIDENT_MESSAGE_MIN} characters so the resident gets a clear explanation.`
  }
  if (text.length > RESIDENT_MESSAGE_MAX) {
    return `Keep the message under ${RESIDENT_MESSAGE_MAX} characters.`
  }
  return null
}
