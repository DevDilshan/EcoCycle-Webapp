export function formatCompactDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export function formatRequestId(id, prefix = 'PR') {
  if (!id) return '—'
  const tail = String(id).replace(/-/g, '').slice(-4).toUpperCase()
  return `${prefix}-${tail}`
}

export function profileInitials(nameOrEmail) {
  if (!nameOrEmail) return '?'
  const parts = nameOrEmail.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return nameOrEmail.charAt(0).toUpperCase()
}

export function shortProfileName(profile) {
  if (!profile) return 'Unknown'
  if (profile.fullName?.trim()) {
    const parts = profile.fullName.trim().split(/\s+/)
    if (parts.length >= 2) {
      return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`
    }
    return parts[0]
  }
  const local = profile.email?.split('@')[0] || 'User'
  return local.charAt(0).toUpperCase() + local.slice(1)
}

export const CATEGORY_PILLS = {
  Bulk: { label: 'Bulk', icon: '📦', className: 'pill-bulk' },
  Recyclable: { label: 'Recyclable', icon: '♻️', className: 'pill-recyclable' },
  Hazardous: { label: 'Hazardous', icon: '☣️', className: 'pill-hazardous' },
  Organic: { label: 'Organic', icon: '🌿', className: 'pill-organic' },
  EWaste: { label: 'E-Waste', icon: '🔌', className: 'pill-ewaste' },
  General: { label: 'General', icon: '🗑️', className: 'pill-general' },
}

export const STATUS_PILLS = {
  Pending: { label: 'Pending', className: 'pill-status-pending' },
  Classified: { label: 'Classified', className: 'pill-status-classified' },
  Approved: { label: 'Pending appr.', className: 'pill-status-danger' },
  Scheduled: { label: 'Scheduled', className: 'pill-status-scheduled' },
  Completed: { label: 'Completed', className: 'pill-status-completed' },
  Rejected: { label: 'Rejected', className: 'pill-status-danger' },
  RevisionRequested: { label: 'Revision', className: 'pill-status-pending' },
}

export const FILTER_PILL_STYLES = {
  '': { label: 'All', className: 'filter-pill-all' },
  Pending: { label: 'Pending', className: 'filter-pill-pending' },
  Classified: { label: 'Classified', className: 'filter-pill-classified' },
  Scheduled: { label: 'Scheduled', className: 'filter-pill-scheduled' },
  Completed: { label: 'Completed', className: 'filter-pill-completed' },
}

// Rough guess from the description, used ONLY for pickups the agent pipeline has
// not classified yet. Prefer the stored category wherever one exists.
//
// Rule order matters, and it mirrors how the classifier is prompted: anything
// with a plug or a circuit board is e-waste, even when it is also large, so
// appliances are tested before the bulky-item keywords. Loose chemicals are
// hazardous; a device containing them is not.
export function inferCategory(description = '') {
  const text = description.toLowerCase()
  if (/e-waste|ewaste|electronic|appliance|fridge|refrigerator|freezer|washing machine|microwave|oven|tv|television|monitor|laptop|computer|phone|printer|cable/.test(text)) return 'EWaste'
  if (/paint|solvent|hazard|battery|chemical/.test(text)) return 'Hazardous'
  if (/garden|organic|compost|leaf/.test(text)) return 'Organic'
  if (/recycl|cardboard|plastic|paper|glass/.test(text)) return 'Recyclable'
  if (/bulk|furniture|sofa|mattress|couch|wardrobe|table|chair/.test(text)) return 'Bulk'
  return 'General'
}

export const MEDAL_ICONS = ['🥇', '🥈', '🥉']
