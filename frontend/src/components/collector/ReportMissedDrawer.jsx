import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { AcDrawer } from '../admin/AcUi'
import { formatRequestId } from '../../lib/adminUi'

// The reasons a collection actually fails, as a crew would say them.
const COMMON_REASONS = [
  'Bin was not put out',
  'Gate was locked',
  'Access blocked by a parked vehicle',
  'Nobody home and the item was inside',
  'Item too heavy for this vehicle',
  'Wrong waste for this collection',
]

/**
 * The form inside the drawer.
 *
 * Mounted with the stop's id as its key so opening a different stop starts
 * empty, rather than carrying the previous reason over to a stop it was never
 * about.
 */
function ReportForm({ stop, busy, onClose, onReport }) {
  const [reason, setReason] = useState('')

  const pickup = stop.pickup
  const title = pickup?.description || 'Pickup stop'
  const canSubmit = reason.trim().length > 0

  return (
    <>
      <p className="ac-id">
        {formatRequestId(stop.id, 'RT')} · {formatRequestId(stop.pickupRequestId)}
      </p>

      <div>
        <strong>{title}</strong>
        {pickup?.address && <p className="ac-drawer-text">{pickup.address}</p>}
      </div>

      <div className="ac-field">
        <label htmlFor="missed-reason">Why could it not be collected?</label>
        <textarea
          id="missed-reason"
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="The resident will see this, so say what happened."
        />
      </div>

      <div className="c-quick" role="group" aria-label="Common reasons">
        {COMMON_REASONS.map((phrase) => (
          <button
            key={phrase}
            type="button"
            className={reason.trim() === phrase ? 'is-on' : undefined}
            onClick={() => setReason(phrase)}
          >
            {phrase}
          </button>
        ))}
      </div>

      <p className="c-hint">
        The office is told, and the resident is sent an explanation. The pickup is
        booked onto a later round automatically.
      </p>

      <div className="ac-actions">
        <button
          type="button"
          className="ac-btn ac-btn-danger"
          disabled={busy || !canSubmit}
          onClick={() => onReport(stop, reason)}
        >
          <TriangleAlert size={16} strokeWidth={2.4} aria-hidden="true" />
          Report as not collected
        </button>
        <button type="button" className="ac-btn ac-btn-ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
    </>
  )
}

/**
 * "Couldn't collect", opened from a stop on the collector's round.
 *
 * Replaces a browser prompt, which showed "localhost says" above the question
 * and gave no room for the quick reasons -- and a one-line box is a poor place
 * to write something a resident will read.
 */
export default function ReportMissedDrawer({ stop, onClose, onReport, busy = false }) {
  return (
    <AcDrawer open={Boolean(stop)} onClose={onClose} title="Couldn't collect">
      {stop && (
        <ReportForm
          key={stop.id}
          stop={stop}
          busy={busy}
          onClose={onClose}
          onReport={onReport}
        />
      )}
    </AcDrawer>
  )
}
