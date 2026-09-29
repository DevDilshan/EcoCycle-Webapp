import { Fragment, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { AcStatusPill } from '../admin/AcPills'
import { formatCompactDate, formatRequestId } from '../../lib/adminUi'
import { pickupLabel } from '../../lib/catalog'

const TYPE_LABELS = {
  missed: 'Missed pickup',
  late: 'Late collection',
  damage: 'Damaged bin',
  default: 'General',
}

const TYPE_PILL_CLASS = {
  missed: 'pill-complaint-missed',
  late: 'pill-complaint-late',
  damage: 'pill-complaint-damage',
  default: 'pill-complaint-open',
}

function inferType(description = '') {
  const text = description.toLowerCase()
  if (/miss/.test(text)) return 'missed'
  if (/late|delay/.test(text)) return 'late'
  if (/damage|broken|bin/.test(text)) return 'damage'
  return 'default'
}

function ComplaintTypePill({ description }) {
  const type = inferType(description)
  return (
    <span className={`design-pill ${TYPE_PILL_CLASS[type]}`}>
      {TYPE_LABELS[type]}
    </span>
  )
}

export default function ResidentComplaintList({ complaints, pickupById }) {
  const [expandedId, setExpandedId] = useState(null)

  if (complaints.length === 0) return null

  return (
    <div className="complaint-grid-table">
      <div className="complaint-grid-header">
        <span>ID</span>
        <span>Issue</span>
        <span>Type</span>
        <span>Filed</span>
        <span>Status</span>
        <span aria-hidden />
      </div>
      {complaints.map((item) => {
        const expanded = expandedId === item.id
        const pickup = pickupById.get(item.pickupRequestId)
        const title = item.description?.trim() || 'Complaint'
        return (
          <Fragment key={item.id}>
            <button
              type="button"
              className={`complaint-grid-row${item.status === 'Resolved' ? ' is-resolved' : ''}`}
              aria-expanded={expanded}
              onClick={() => setExpandedId(expanded ? null : item.id)}
            >
              <span className="complaint-grid-id">{formatRequestId(item.id, 'CMP')}</span>
              <span className="complaint-grid-issue">
                <strong>{title.length > 56 ? `${title.slice(0, 56)}…` : title}</strong>
                {pickup && (
                  <small>Pickup {formatRequestId(item.pickupRequestId)}</small>
                )}
              </span>
              <span><ComplaintTypePill description={item.description} /></span>
              <span className="complaint-grid-muted">{formatCompactDate(item.createdAt)}</span>
              <span><AcStatusPill status={item.status} /></span>
              <span className={`complaint-grid-chevron${expanded ? ' open' : ''}`}>
                <ChevronRight size={18} strokeWidth={2} aria-hidden />
              </span>
            </button>
            {expanded && (
              <div className="complaint-grid-detail">
                <div className="complaint-detail-block">
                  <span className="complaint-detail-label">Description</span>
                  <p>{item.description || '—'}</p>
                </div>
                <div className="complaint-detail-meta">
                  <div>
                    <span className="complaint-detail-label">Related pickup</span>
                    <p>
                      {pickup
                        ? pickupLabel(pickup)
                        : formatRequestId(item.pickupRequestId)}
                    </p>
                  </div>
                  <div>
                    <span className="complaint-detail-label">Filed</span>
                    <p>{formatCompactDate(item.createdAt)}</p>
                  </div>
                  {item.resolvedAt && (
                    <div>
                      <span className="complaint-detail-label">Resolved</span>
                      <p>{formatCompactDate(item.resolvedAt)}</p>
                    </div>
                  )}
                </div>
                {item.adminNotes?.trim() && (
                  <div className="complaint-detail-admin">
                    <span className="complaint-detail-label">Response from support</span>
                    <p>{item.adminNotes}</p>
                  </div>
                )}
              </div>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
