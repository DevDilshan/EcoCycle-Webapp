import { formatDate, shortId } from './api'

export function profileLabel(profile) {
  if (!profile) return '—'
  if (profile.fullName?.trim()) {
    return `${profile.fullName} (${profile.email})`
  }
  return profile.email || shortId(profile.id)
}

function formatPreferredDate(value) {
  if (!value) return 'No date set'
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function truncate(text, max = 50) {
  if (!text?.trim()) return 'No description'
  const trimmed = text.trim()
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`
}

export function pickupLabel(pickup, { residentName } = {}) {
  if (!pickup) return '—'

  const parts = [
    formatPreferredDate(pickup.preferredDate),
    pickup.status,
    truncate(pickup.description),
  ]

  if (residentName) {
    parts.unshift(residentName)
  }

  return parts.join(' · ')
}

export function toSelectOptions(items, labelFn, valueKey = 'id') {
  return items.map((item) => ({
    value: item[valueKey],
    label: labelFn(item),
  }))
}
