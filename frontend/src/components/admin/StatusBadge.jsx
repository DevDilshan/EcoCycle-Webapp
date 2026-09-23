const STATUS_STYLES = {
  Open: 'badge-blue',
  InProgress: 'badge-yellow',
  Resolved: 'badge-green',
  Pending: 'badge-yellow',
  Classified: 'badge-blue',
  Approved: 'badge-green',
  Scheduled: 'badge-purple',
  Completed: 'badge-green',
  Rejected: 'badge-red',
  RevisionRequested: 'badge-orange',
  Missed: 'badge-red',
}

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || 'badge-gray'
  return <span className={`badge ${style}`}>{status}</span>
}
