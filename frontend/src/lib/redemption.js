/** How an approved reward reaches the resident, in the words each side uses. */
export const DELIVERY = {
  Collect: { option: 'Collect in person', done: 'Collected', waiting: 'Ready to collect', adminWaiting: 'Awaiting collection', action: 'Mark collected' },
  Email: { option: 'Sent by email', done: 'Emailed', waiting: 'Being emailed', adminWaiting: 'To email', action: 'Mark emailed' },
  Post: { option: 'Sent by post', done: 'Posted', waiting: 'Being posted', adminWaiting: 'To post', action: 'Mark posted' },
}

export const deliveryOf = (item) => DELIVERY[item?.delivery] ?? DELIVERY.Collect

/** What a resident sees on a redemption request: the status wording. */
export function redemptionStatusLabel(item) {
  if (item.status !== 'Approved' || !item.collectionCode) return item.status
  return item.fulfilledAt ? deliveryOf(item).done : deliveryOf(item).waiting
}

/** A posted reward needs an address long enough to be one. */
export function addressError(rewardItem, address) {
  if (rewardItem?.delivery !== 'Post') return null
  return String(address ?? '').trim().length < 10 ? 'Enter the full address to post this reward to.' : null
}

/** Pill tone: a handed-over reward is finished (green), not waiting (amber). */
export const redemptionPillStatus = (item) => (item.fulfilledAt ? 'Completed' : item.status)
