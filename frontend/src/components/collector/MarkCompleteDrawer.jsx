import { useState } from 'react'
import { Camera, Check } from 'lucide-react'
import { AcDrawer } from '../admin/AcUi'
import { AcCategory } from '../admin/AcPills'
import { formatRequestId } from '../../lib/adminUi'
import { formatStopTime } from '../../lib/collectorUi'

// The notes a collector actually writes at a stop, offered as one tap each.
const QUICK_NOTES = [
  'Bin overfilled',
  'Items not sorted',
  'Hazardous item left behind',
  'Collected extra bag',
  'Resident not home, collected from gate',
]

/**
 * The form inside the drawer.
 *
 * Split out and mounted with the stop's id as its key, so opening a different
 * stop starts with that stop's own notes. Resetting through an effect instead
 * would risk carrying one stop's text over to the next.
 */
function CompleteForm({ stop, busy, onClose, onComplete }) {
  const [notes, setNotes] = useState(stop.issueNotes || '')

  const pickup = stop.pickup
  const title = pickup?.description || 'Pickup stop'

  function toggleNote(phrase) {
    setNotes((current) => {
      if (current.toLowerCase().includes(phrase.toLowerCase())) {
        // Remove it again, and tidy the separator it leaves behind.
        return current
          .replace(new RegExp(`\\s*${phrase}\\.?`, 'i'), '')
          .replace(/\s{2,}/g, ' ')
          .trim()
      }
      return current ? `${current.replace(/\s*$/, '')} ${phrase}.` : `${phrase}.`
    })
  }

  return (
    <>
      <p className="ac-id">
        {formatRequestId(stop.id, 'RT')} · {formatRequestId(stop.pickupRequestId)}
      </p>

      <div className="c-ns-grid">
        <div className="c-ns-photo">
          {pickup?.photoUrl
            ? <img src={pickup.photoUrl} alt={`Photo submitted with ${title}`} />
            : <Camera size={20} strokeWidth={2} aria-hidden="true" />}
        </div>
        <div>
          <strong>{title}</strong>
          <div className="c-meta">
            {pickup?.category && <AcCategory category={pickup.category} confidence={pickup.confidence} />}
            {pickup?.zoneName && <span>{pickup.zoneName}</span>}
            <span>{formatStopTime(stop.scheduledDate)}</span>
          </div>
        </div>
      </div>

      <div className="ac-field">
        <label htmlFor="issue-notes">Issue notes (optional)</label>
        <textarea
          id="issue-notes"
          rows={4}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Anything the admin should know about this stop…"
        />
      </div>

      <div className="c-quick" role="group" aria-label="Add a common note">
        {QUICK_NOTES.map((phrase) => {
          const on = notes.toLowerCase().includes(phrase.toLowerCase())
          return (
            <button
              key={phrase}
              type="button"
              className={on ? 'is-on' : undefined}
              aria-pressed={on}
              onClick={() => toggleNote(phrase)}
            >
              {on ? '✓' : '+'} {phrase}
            </button>
          )
        })}
      </div>

      <p className="c-hint">Notes are saved with the stop and shown to the admin.</p>

      <div className="ac-actions">
        <button
          type="button"
          className="ac-btn ac-btn-primary"
          disabled={busy}
          onClick={() => onComplete(stop, notes)}
        >
          <Check size={16} strokeWidth={2.4} aria-hidden="true" />
          Mark complete
        </button>
        <button type="button" className="ac-btn ac-btn-ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
    </>
  )
}

/**
 * "Mark stop complete", opened from either collector page.
 *
 * Marking complete is the collector's only write and the notes are optional, so
 * the primary button is never blocked on the textarea.
 */
export default function MarkCompleteDrawer({ stop, onClose, onComplete, busy = false }) {
  return (
    <AcDrawer open={Boolean(stop)} onClose={onClose} title="Mark stop complete">
      {stop && (
        <CompleteForm
          key={stop.id}
          stop={stop}
          busy={busy}
          onClose={onClose}
          onComplete={onComplete}
        />
      )}
    </AcDrawer>
  )
}
