import { profileInitials, shortProfileName } from '../../lib/adminUi'

const AVATAR_COLORS = ['#2f7d51', '#6d4bb0', '#2b6cb0', '#c26a2a', '#b7791f']

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

export default function ZoneCard({ zone, collectorProfile, stats, onEdit }) {
  // Counts come from RouteAssignments for this zone. There is no recorded
  // capacity per zone, so there is no honest "% loaded" to show -- the counts
  // are reported as they are. `stats` is undefined until the report loads.
  const hasStats = Boolean(stats)
  const pending = stats?.pendingAssignments ?? 0
  const dueToday = stats?.dueToday ?? 0
  const inactive = zone.isActive === false

  return (
    <article className={`zone-card${inactive ? ' zone-card-inactive' : ''}`}>
      <div className="zone-card-top">
        <div>
          <h3 className="zone-card-title">{zone.name}</h3>
          <p className="zone-card-sub">{zone.description || 'Collection zone'}</p>
        </div>
        <span className={`zone-status-pill${inactive ? ' zone-status-inactive' : ''}`}>
          {inactive ? 'Inactive' : 'Active'}
        </span>
      </div>
      <div className="zone-card-stats">
        {hasStats ? (
          <>
            <span>Waiting: <strong>{plural(pending, 'pickup')}</strong></span>
            <span>Due today: <strong>{dueToday}</strong></span>
          </>
        ) : (
          <span className="zone-card-stats-muted">Loading pickup counts…</span>
        )}
      </div>
      <p className="zone-card-label">Assigned collectors</p>
      <div className="zone-collector-chips">
        {collectorProfile ? (
          <span className="zone-collector-chip">
            <span className="zone-collector-avatar" style={{ background: AVATAR_COLORS[0] }}>
              {profileInitials(collectorProfile.fullName || collectorProfile.email)}
            </span>
            {shortProfileName(collectorProfile)}
          </span>
        ) : (
          <span className="zone-collector-empty">No collector assigned</span>
        )}
        <button type="button" className="zone-collector-add" onClick={onEdit} aria-label="Manage zone">
          +
        </button>
      </div>
    </article>
  )
}
