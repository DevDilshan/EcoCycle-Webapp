// Client-side checks for the rewards forms. They mirror the backend's rules
// (the API validates again and stays the authority) so a mistake is explained
// next to the field instead of coming back as a failed request.

import { validRewardImage } from './rewardImages'

const MAX_POINTS = 100000

function isWholeNumber(value) {
  return value !== '' && value !== null && value !== undefined && Number.isInteger(Number(value))
}

/** Reward item form: name, cost, optional stock, description. */
export function validateRewardItem({ name, pointsCost, stock, description, imageUrl }) {
  const errors = {}

  if (!String(name ?? '').trim()) errors.name = 'Give the item a name.'
  else if (String(name).trim().length > 120) errors.name = 'Keep the name under 120 characters.'

  if (!isWholeNumber(pointsCost)) errors.pointsCost = 'Enter the cost as a whole number of points.'
  else if (Number(pointsCost) < 1) errors.pointsCost = 'The cost must be at least 1 point.'
  else if (Number(pointsCost) > MAX_POINTS) errors.pointsCost = `The cost cannot be more than ${MAX_POINTS.toLocaleString()} points.`

  if (stock !== '' && stock !== null && stock !== undefined) {
    if (!isWholeNumber(stock)) errors.stock = 'Stock must be a whole number, or empty for unlimited.'
    else if (Number(stock) < 0) errors.stock = 'Stock cannot be negative.'
  }

  if (String(description ?? '').length > 500) errors.description = 'Keep the description under 500 characters.'
  if (String(imageUrl ?? '').length > 2048 || !validRewardImage(imageUrl))
    errors.imageUrl = 'Choose a catalog image or enter a valid HTTPS image URL.'

  return errors
}

/** Editing an existing points entry: any non-zero whole number, plus a reason. */
export function validatePointsEntry({ pointsEarned, reason }) {
  const errors = {}

  if (!isWholeNumber(pointsEarned)) errors.pointsEarned = 'Enter a whole number of points.'
  else if (Number(pointsEarned) === 0) errors.pointsEarned = 'An entry cannot be 0 points. Reverse it instead.'
  else if (Math.abs(Number(pointsEarned)) > MAX_POINTS) errors.pointsEarned = `Points cannot be more than ${MAX_POINTS.toLocaleString()}.`

  if (!String(reason ?? '').trim()) errors.reason = 'Say why the entry changed.'
  else if (String(reason).length > 500) errors.reason = 'Keep the reason under 500 characters.'

  return errors
}

/** Manual bonus award. */
export function validateAward({ residentId, pickupRequestId, pointsEarned, reason }) {
  const errors = {}

  if (!residentId) errors.residentId = 'Choose a resident.'
  if (!pickupRequestId) errors.pickupRequestId = 'Choose the pickup this award belongs to.'

  if (!isWholeNumber(pointsEarned)) errors.pointsEarned = 'Enter a whole number of points.'
  else if (Number(pointsEarned) < 1) errors.pointsEarned = 'Award at least 1 point.'
  else if (Number(pointsEarned) > MAX_POINTS) errors.pointsEarned = `Award no more than ${MAX_POINTS.toLocaleString()} points.`

  if (!String(reason ?? '').trim()) errors.reason = 'Say why the points are being awarded.'
  else if (String(reason).length > 500) errors.reason = 'Keep the reason under 500 characters.'

  return errors
}

/** Admin decision on a redemption request: declining needs an explanation. */
export function validateReview(action, note) {
  const errors = {}
  if (action === 'reject' && !String(note ?? '').trim()) errors.note = 'Tell the resident why the request was declined.'
  if (String(note ?? '').length > 500) errors.note = 'Keep the note under 500 characters.'
  return errors
}

export const hasErrors = (errors) => Object.keys(errors).length > 0
