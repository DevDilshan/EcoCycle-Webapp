import { formatRequestId } from './adminUi'

/** Accepts full UUID or display ref like CMP-4490 (matches tracked complaints only). */
export function resolveComplaintLookupId(input, trackedComplaints = []) {
  const trimmed = input.trim()
  if (!trimmed) return ''

  const refMatch = /^cmp-([a-f0-9]{4})$/i.exec(trimmed)
  if (refMatch) {
    const ref = `CMP-${refMatch[1].toUpperCase()}`
    const found = trackedComplaints.find(
      (c) => formatRequestId(c.id, 'CMP').toUpperCase() === ref,
    )
    if (found) return found.id
  }

  return trimmed
}
