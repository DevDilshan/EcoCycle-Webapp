const COMPLETION_LABELS = {
  0: 'Pending',
  1: 'Completed',
  2: 'Missed',
  Pending: 'Pending',
  Completed: 'Completed',
  Missed: 'Missed',
}

export function formatCompletionStatus(status) {
  return COMPLETION_LABELS[status] ?? String(status ?? '—')
}

export function isRoutePending(status) {
  const label = formatCompletionStatus(status)
  return label === 'Pending'
}
