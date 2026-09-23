import { formatCompactDate, formatRequestId } from '../../lib/adminUi'

const TYPE_PILLS = {
  missed: { label: 'Missed pickup', className: 'pill-complaint-missed' },
  late: { label: 'Late', className: 'pill-complaint-late' },
  damage: { label: 'Damage', className: 'pill-complaint-damage' },
  default: { label: 'Complaint', className: 'pill-complaint-missed' },
}

const STATUS_PILLS = {
  Open: { label: 'Open', className: 'pill-complaint-open' },
  InProgress: { label: 'In review', className: 'pill-complaint-review' },
  Resolved: { label: 'Resolved', className: 'pill-complaint-resolved' },
}

function inferType(description = '') {
  const text = description.toLowerCase()
  if (/miss/.test(text)) return 'missed'
  if (/late|delay/.test(text)) return 'late'
  if (/damage|broken|bin/.test(text)) return 'damage'
  return 'default'
}

export default function ComplaintRowCard({
  complaint,
  residentLabel,
  zoneLabel,
  onResolve,
  onView,
}) {
  const typeKey = inferType(complaint.description)
  const typePill = TYPE_PILLS[typeKey]
  const statusPill = STATUS_PILLS[complaint.status] || STATUS_PILLS.Open
  const resolved = complaint.status === 'Resolved'
  const pickupRef = complaint.pickupRequestId
    ? ` · #${formatRequestId(complaint.pickupRequestId)}`
    : ''

  return (
    <article className={`complaint-row-card${resolved ? ' complaint-row-resolved' : ''}`}>
      <span className="complaint-row-id">{formatRequestId(complaint.id, 'CMP')}</span>
      <div className="complaint-row-body">
        <p className="complaint-row-title">
          {complaint.description?.slice(0, 60) || 'Complaint'}{pickupRef}
        </p>
        <p className="complaint-row-sub">
          {residentLabel} · {zoneLabel || '—'} · {formatCompactDate(complaint.createdAt)}
        </p>
      </div>
      <span className={`design-pill ${typePill.className}`}>{typePill.label}</span>
      <span className={`design-pill ${statusPill.className}`}>{statusPill.label}</span>
      {resolved ? (
        <button type="button" className="complaint-btn-view" onClick={() => onView?.(complaint)}>
          View
        </button>
      ) : (
        <button type="button" className="complaint-btn-resolve" onClick={() => onResolve?.(complaint)}>
          Resolve
        </button>
      )}
    </article>
  )
}
