import { STATUS_PILLS } from '../../lib/adminUi'

export default function PickupStatusPill({ status }) {
  const config = STATUS_PILLS[status] || { label: status, className: 'pill-status-pending' }
  return (
    <span className={`design-pill ${config.className}`}>
      {config.label}
    </span>
  )
}