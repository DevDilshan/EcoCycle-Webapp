import { profileInitials, shortProfileName } from '../../lib/adminUi'

const AVATAR_COLORS = ['#2f7d51', '#6d4bb0', '#2b6cb0', '#c26a2a', '#b7791f']

function loadColor(pct) {
  if (pct >= 90) return '#c0392b'
  if (pct >= 70) return '#b7791f'
  return '#2f7d51'
}

export default function ZoneCard({ zone, collectorProfile, stats, onEdit }) {
  const loadPct = stats?.loadPct ?? 45
  const todayPickups = stats?.todayPickups ?? 0
  const overloaded = loadPct >= 90

  return (
    <article className={`zone-card${overloaded ? ' zone-card-overloaded' : ''}`}>
      <div className="zone-card-top">
        <div>
          <h3 className="zone-card-title">{zone.name}</h3>
          <p className="zone-card-sub">{zone.description || 'Collection zone'}</p>
        </div>
        <span className={`zone-status-pill${overloaded ? ' zone-status-overloaded' : ''}`}>
          {overloaded ? 'Overloaded' : 'Active'}
        </span>
      </div>
      <div className="zone-card-stats">
        <span>Today: <strong>{todayPickups} pickups</strong></span>
        <span>Load: <strong style={{ color: loadColor(loadPct) }}>{loadPct}%</strong></span>
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
