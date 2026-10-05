import { Archive, MapPin, Pencil, Trash2, TrendingUp, TriangleAlert } from 'lucide-react'
import { profileInitials, shortProfileName } from '../../lib/adminUi'
import { AcStatusPill } from './AcPills'

/** Single letters, because a card has room for a rhythm but not for seven words. */
const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * The week as seven slots, with the collected ones filled.
 *
 * Shown as the whole week rather than a list of the days that are on, because the
 * shape is the point: "Mon and Thu" takes a moment to picture, whereas a filled
 * second and fifth slot is the picture. The days a zone is collected on were not
 * on this card at all, which is an odd omission for the one fact that decides
 * when anything in the zone gets picked up.
 */
function CollectionWeek({ days = [] }) {
  if (days.length === 0) {
    return <span className="ac-zone-days is-none">No fixed collection days</span>
  }

  return (
    <span
      className="ac-zone-days"
      // The dots are decorative; the sentence is what a screen reader reads.
      aria-label={`Collected on ${days.map((d) => DAY_NAMES[d]).join(', ')}`}
    >
      {DAY_INITIALS.map((initial, index) => (
        <i
          // The initials repeat (S, T), so the key is the column, not the letter.
          key={index}
          className={days.includes(index) ? 'is-on' : undefined}
          aria-hidden="true"
        >
          {initial}
        </i>
      ))}
    </span>
  )
}

export default function ZoneCard({
  zone,
  collectorProfile,
  stats,
  onEdit,
  onDeactivate,
  onDelete,
  busy = false,
  isBusiest = false,
}) {
  // Counts come from RouteAssignments for this zone. There is no recorded
  // capacity per zone, so there is no honest "% loaded" to show -- the counts
  // are reported as they are. `stats` is undefined until the report loads.
  const hasStats = Boolean(stats)
  const pending = stats?.pendingAssignments ?? 0
  const dueToday = stats?.dueToday ?? 0
  const missed = stats?.missedAssignments ?? 0
  const inactive = zone.isActive === false
  const unplaced = zone.latitude == null || zone.longitude == null

  return (
    <article className={`ac-zone-card${isBusiest ? ' is-busiest' : ''}${inactive ? ' is-retired' : ''}`}>
      <div className="ac-zone-top">
        <strong>{zone.name}</strong>
        {/* "Active" on every card was noise: it is the expected state, and a
            badge that is always present stops being read. Only the exception
            is worth the space. */}
        {inactive && <AcStatusPill status="Inactive" />}
        {isBusiest && !inactive && (
          <span className="ac-pill ac-s-ok" title="Most pickups waiting today">
            <TrendingUp size={13} strokeWidth={2.4} aria-hidden="true" />
            Busiest
          </span>
        )}
      </div>

      <CollectionWeek days={zone.collectionDays} />

      {collectorProfile ? (
        <span className="ac-collector">
          <span className="ac-avatar" aria-hidden="true">
            {profileInitials(collectorProfile.fullName || collectorProfile.email)}
          </span>
          {shortProfileName(collectorProfile)}
        </span>
      ) : (
        <span className="ac-pill ac-s-warn">
          <TriangleAlert size={13} strokeWidth={2.4} aria-hidden="true" />
          No collector assigned
        </span>
      )}

      {/* Three tiles rather than two and a loose pill below them. Missed was a
          separate red badge that appeared and disappeared, which changed the
          card's height and broke the grid's rhythm; as a tile it always has its
          place and merely changes colour. */}
      <div className="ac-zone-stats">
        <div>
          <b>{hasStats ? pending : '—'}</b>
          <span>waiting</span>
        </div>
        <div>
          <b>{hasStats ? dueToday : '—'}</b>
          <span>due today</span>
        </div>
        <div className={hasStats && missed > 0 ? 'is-bad' : undefined}>
          <b>{hasStats ? missed : '—'}</b>
          <span>missed</span>
        </div>
      </div>

      {unplaced && (
        <p className="ac-zone-note">
          <MapPin size={13} strokeWidth={2} aria-hidden="true" />
          No location, so it is not on the map
        </p>
      )}

      <div className="ac-zone-foot">
        <button type="button" className="ac-btn ac-btn-soft ac-btn-sm" onClick={onEdit}>
          <Pencil size={14} strokeWidth={2} aria-hidden="true" />
          Edit
        </button>
        {/* Retiring a zone keeps the row: pickups and route assignments point at
            it, so the label says what actually happens. It is tucked to the
            right and quieter than Edit, so the two are not equally easy to hit.

            A retired zone offers Delete instead. The API only allows it when
            nothing was ever booked in the zone. */}
        {inactive ? (
          <button
            type="button"
            className="ac-btn ac-btn-danger ac-btn-sm ac-zone-retire"
            onClick={() => onDelete?.(zone)}
            disabled={busy}
            aria-label={`Delete ${zone.name}`}
            title="Delete this retired zone for good"
          >
            <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
            Delete
          </button>
        ) : (
          <button
            type="button"
            className="ac-btn ac-btn-ghost ac-btn-sm ac-zone-retire"
            onClick={() => onDeactivate?.(zone)}
            disabled={busy}
            aria-label={`Retire ${zone.name}`}
            title="Stop routing new pickups to this zone"
          >
            <Archive size={14} strokeWidth={2} aria-hidden="true" />
            Retire
          </button>
        )}
      </div>
    </article>
  )
}
