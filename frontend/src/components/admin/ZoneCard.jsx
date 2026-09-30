import { Archive, MapPin, Pencil, TrendingUp, TriangleAlert } from 'lucide-react'
import { profileInitials, shortProfileName } from '../../lib/adminUi'
import { AcStatusPill } from './AcPills'

export default function ZoneCard({
  zone,
  collectorProfile,
  stats,
  onEdit,
  onDeactivate,
  busy = false,
  isBusiest = false,
}) {
  // Counts come from RouteAssignments for this zone. There is no recorded
  // capacity per zone, so there is no honest "% loaded" to show -- the counts
  // are reported as they are. `stats` is undefined until the report loads.
  const hasStats = Boolean(stats)
  const pending = stats?.pendingAssignments ?? 0
  const dueToday = stats?.dueToday ?? 0
  const inactive = zone.isActive === false
  const unplaced = zone.latitude == null || zone.longitude == null

  return (
    <article className={`ac-zone-card${isBusiest ? ' is-busiest' : ''}`}>
      <div className="ac-zone-top">
        <strong>{zone.name}</strong>
        <AcStatusPill status={inactive ? 'Inactive' : 'Active'} />
      </div>

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

      <div className="ac-zone-stats">
        <div>
          <b>{hasStats ? pending : '—'}</b>
          <span>waiting</span>
        </div>
        <div>
          <b>{hasStats ? dueToday : '—'}</b>
          <span>due today</span>
        </div>
      </div>

      {hasStats && stats.missedAssignments > 0 && (
        <span className="ac-pill ac-s-bad">
          <TriangleAlert size={13} strokeWidth={2.4} aria-hidden="true" />
          {stats.missedAssignments} missed
        </span>
      )}

      <div className="ac-zone-foot">
        <button type="button" className="ac-btn ac-btn-ghost ac-btn-sm" onClick={onEdit}>
          <Pencil size={14} strokeWidth={2} aria-hidden="true" />
          Edit
        </button>
        {/* Retiring a zone keeps the row: pickups and route assignments point at
            it, so the label says what actually happens. */}
        <button
          type="button"
          className="ac-btn ac-btn-danger ac-btn-sm"
          onClick={() => onDeactivate?.(zone)}
          disabled={busy || inactive}
          title={inactive ? 'This zone is already deactivated' : 'Stop routing new pickups to this zone'}
        >
          <Archive size={14} strokeWidth={2} aria-hidden="true" />
          {inactive ? 'Deactivated' : 'Deactivate'}
        </button>
        {isBusiest && (
          <span className="ac-pill ac-s-ok">
            <TrendingUp size={13} strokeWidth={2.4} aria-hidden="true" />
            Busiest today
          </span>
        )}
      </div>

      {unplaced && (
        <p className="ac-zone-note">
          <MapPin size={13} strokeWidth={2} aria-hidden="true" />
          No coordinates, not shown on the map
        </p>
      )}
    </article>
  )
}
