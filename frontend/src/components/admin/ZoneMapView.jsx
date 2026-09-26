/**
 * Zone overview for the Routes page: summary counts, a map of the active zones,
 * and per-zone pickup counts.
 *
 * Every figure here comes from /routes/zone-load and /routes/load-report, and
 * every marker from a zone's stored coordinates. Zones carry a single point
 * rather than a boundary, so they are plotted as pins, not areas -- and nothing
 * is drawn for a zone that has no coordinates.
 */
import ZoneMap from './ZoneMap'

export default function ZoneMapView({ zones = [], zoneLoad = [], loadReport = [] }) {
  const loadByZone = new Map(zoneLoad.map((row) => [row.zoneId, row]))

  // Anything the map cannot honestly show, with the reason. Deactivated zones
  // are excluded by choice; zones without coordinates simply cannot be placed.
  const excluded = zones
    .filter((zone) => zone.isActive === false || zone.latitude == null || zone.longitude == null)
    .map((zone) => ({
      zone,
      reason: zone.isActive === false ? 'deactivated' : 'no coordinates set',
    }))

  // Real figures, with no stand-in values: a quiet day should read as a quiet
  // day rather than borrowing numbers from somewhere else.
  const activeCollectors = loadReport.filter((row) => row.pendingAssignments > 0).length
  const totalCollectors = loadReport.length
  const pendingPickups = loadReport.reduce((sum, row) => sum + row.pendingAssignments, 0)
  const dueToday = zoneLoad.reduce((sum, row) => sum + row.dueToday, 0)

  const busiest = zoneLoad.reduce(
    (top, row) => (row.pendingAssignments > (top?.pendingAssignments ?? -1) ? row : top),
    null,
  )

  return (
    <div className="zone-overview">
      <div className="zone-overview-summary">
        <div className="zone-overview-stat">
          <span className="zone-overview-value">{pendingPickups}</span>
          <span className="zone-overview-label">pickups waiting</span>
        </div>
        <div className="zone-overview-stat">
          <span className="zone-overview-value">{dueToday}</span>
          <span className="zone-overview-label">due today</span>
        </div>
        <div className="zone-overview-stat">
          <span className="zone-overview-value">
            {activeCollectors}<small> / {totalCollectors}</small>
          </span>
          <span className="zone-overview-label">collectors with work</span>
        </div>
      </div>

      <ZoneMap zones={zones} loadByZone={loadByZone} />

      {excluded.length > 0 && (
        <div className="zone-map-excluded">
          <p className="zone-map-excluded-note">
            Deactivated zones are not shown on the map. Zones without coordinates cannot be placed.
          </p>
          <ul>
            {excluded.map(({ zone, reason }) => (
              <li key={zone.id}>
                <strong>{zone.name}</strong> — {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {zones.length === 0 ? (
        <p className="admin-empty">No zones yet.</p>
      ) : (
        <div className="zone-overview-grid">
          {zones.map((zone) => {
            const stats = loadByZone.get(zone.id)
            const waiting = stats?.pendingAssignments ?? 0
            const inactive = zone.isActive === false
            const isBusiest = Boolean(
              busiest && busiest.zoneId === zone.id && busiest.pendingAssignments > 0,
            )

            return (
              <div
                key={zone.id}
                className={`zone-overview-tile${inactive ? ' zone-overview-tile-inactive' : ''}${
                  isBusiest ? ' zone-overview-tile-busiest' : ''
                }`}
              >
                <div className="zone-overview-tile-head">
                  <strong>{zone.name}</strong>
                  {inactive && <span className="zone-overview-tag">Inactive</span>}
                  {isBusiest && <span className="zone-overview-tag">Busiest</span>}
                </div>
                <p className="zone-overview-tile-counts">
                  {stats ? (
                    <>
                      {waiting} waiting · {stats.dueToday} due today
                    </>
                  ) : (
                    'Counts unavailable'
                  )}
                </p>
                {stats && stats.missedAssignments > 0 && (
                  <p className="zone-overview-tile-missed">
                    {stats.missedAssignments} missed
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="zone-overview-note">
        Counts come from route assignments per zone. Zones have no recorded
        capacity, so no “% loaded” is shown.
      </p>
    </div>
  )
}
