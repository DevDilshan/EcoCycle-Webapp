const STORAGE_KEY = 'ecocycle-pending-approvals'

export function storeApproval(approval) {
  if (!approval?.id) return
  const existing = loadStoredApprovals()
  const next = [
    {
      id: approval.id,
      pickupRequestId: approval.pickupRequestId,
      flagReason: approval.flagReason,
      status: approval.status,
      createdAt: approval.createdAt,
    },
    ...existing.filter((item) => item.id !== approval.id),
  ].slice(0, 20)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event('ecocycle-approvals-updated'))
}

export function loadStoredApprovals() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
