export const COMPLAINT_DESCRIPTION_MIN = 10
export const COMPLAINT_DESCRIPTION_MAX = 2000

export function mapComplaintBackendErrors(details) {
  if (!details || typeof details !== 'object') return null
  const out = {}
  for (const [key, msgs] of Object.entries(details)) {
    const field = key.charAt(0).toLowerCase() + key.slice(1)
    out[field] = Array.isArray(msgs) ? msgs[0] : String(msgs)
  }
  return Object.keys(out).length ? out : null
}

/**
 * @param {{ pickupRequestId?: string, description?: string }} form
 * @param {{ pickups?: { id: string }[], complaints?: { pickupRequestId: string, status: string }[] }} context
 */
export function validateComplaintForm(form, { pickups = [], complaints = [] } = {}) {
  const errors = {}

  const pickupId = (form.pickupRequestId || '').trim()
  if (!pickupId) {
    errors.pickupRequestId = 'Choose the pickup this complaint is about.'
  } else if (pickups.length > 0 && !pickups.some((p) => p.id === pickupId)) {
    errors.pickupRequestId = 'That pickup is not on your account.'
  } else {
    const openForPickup = complaints.find(
      (c) => c.pickupRequestId === pickupId && c.status !== 'Resolved',
    )
    if (openForPickup) {
      errors.pickupRequestId = 'You already have an open complaint for this pickup.'
    }
  }

  const desc = (form.description || '').trim()
  if (!desc) {
    errors.description = 'Describe what went wrong with this pickup.'
  } else if (desc.length < COMPLAINT_DESCRIPTION_MIN) {
    errors.description = `Use at least ${COMPLAINT_DESCRIPTION_MIN} characters so support can help.`
  } else if (desc.length > COMPLAINT_DESCRIPTION_MAX) {
    errors.description = `Keep your description under ${COMPLAINT_DESCRIPTION_MAX} characters.`
  }

  return errors
}
