import { useState } from 'react'
import { ChevronRight, MessageSquare } from 'lucide-react'
import { AcStatusPill } from '../admin/AcPills'
import { formatCompactDate, formatRequestId } from '../../lib/adminUi'
import { pickupLabel } from '../../lib/catalog'

export default function ResidentComplaintList({ complaints, pickupById }) {
  const [expandedId, setExpandedId] = useState(null)

  if (complaints.length === 0) return null

  return (
    <div className="r-items">
      {complaints.map((item) => {
        const expanded = expandedId === item.id
        const pickup = pickupById.get(item.pickupRequestId)
        const title = item.description?.trim() || 'Complaint'

        return (
          <div className={`r-item${expanded ? ' is-open' : ''}`} key={item.id}>
            <button
              type="button"
              className="r-item-head"
              aria-expanded={expanded}
              onClick={() => setExpandedId(expanded ? null : item.id)}
            >
              <span className="ac-ic">
                <MessageSquare size={18} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="r-item-main">
                <strong>{title}</strong>
                <small>
                  {formatRequestId(item.id, 'CMP')} · {formatCompactDate(item.createdAt)}
                </small>
              </span>
              <AcStatusPill status={item.status} />
              <ChevronRight className="r-item-chev" size={18} strokeWidth={2.2} aria-hidden="true" />
            </button>

            {expanded && (
              <div className="r-item-body">
                <p style={{ margin: 0, lineHeight: 1.55 }}>{item.description || '—'}</p>

                <dl className="ac-kv">
                  <dt>Related pickup</dt>
                  <dd>{pickup ? pickupLabel(pickup) : formatRequestId(item.pickupRequestId)}</dd>
                  <dt>Filed</dt>
                  <dd>{formatCompactDate(item.createdAt)}</dd>
                  {item.resolvedAt && (
                    <>
                      <dt>Resolved</dt>
                      <dd>{formatCompactDate(item.resolvedAt)}</dd>
                    </>
                  )}
                </dl>

                {/* The only part written by a person rather than generated, so
                    it is given its own block instead of another table row. */}
                {item.adminNotes?.trim() && (
                  <div className="r-notice is-info">
                    <strong>Response from support</strong>
                    <p>{item.adminNotes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
