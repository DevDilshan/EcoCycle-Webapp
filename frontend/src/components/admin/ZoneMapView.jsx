export default function ZoneMapView({ zones = [], loadReport = [] }) {
  const totalPickups = loadReport.reduce((sum, row) => sum + row.totalAssignments, 0)
  const activeTrucks = loadReport.filter((row) => row.pendingAssignments > 0).length

  const overlays = [
    { name: 'North-3', load: 78, color: '#2f7d51', top: 40, left: 40, width: 220, height: 120, overloaded: false },
    { name: 'East-1', load: 45, color: '#2b6cb0', top: 40, left: 320, width: 250, height: 120, overloaded: false },
    { name: 'West-2', load: 96, color: '#c0392b', top: 210, left: 40, width: 220, height: 150, overloaded: true },
    { name: 'South-4', load: 30, color: '#6d4bb0', top: 210, left: 320, width: 250, height: 150, overloaded: false },
  ]

  return (
    <div className="zone-map-view">
      {overlays.map((zone) => (
        <div
          key={zone.name}
          className="zone-map-overlay"
          style={{
            top: zone.top,
            left: zone.left,
            width: zone.width,
            height: zone.height,
            background: `${zone.color}24`,
            borderColor: `${zone.color}88`,
          }}
        >
          <span className="zone-map-label" style={{ background: zone.color }}>
            {zone.name} · {zone.load}%{zone.overloaded ? ' overloaded' : ''}
          </span>
        </div>
      ))}

      <div className="zone-map-truck" style={{ top: 90, left: 130, borderColor: '#2f7d51' }}>🚛</div>
      <div className="zone-map-truck" style={{ top: 250, left: 120, borderColor: '#c0392b' }}>🚛</div>
      <div className="zone-map-truck" style={{ top: 90, left: 430, borderColor: '#2b6cb0' }}>🚛</div>

      <div className="zone-map-dot" style={{ top: 130, left: 200, background: '#2f7d51' }} />
      <div className="zone-map-dot" style={{ top: 70, left: 90, background: '#2f7d51' }} />
      <div className="zone-map-dot" style={{ top: 300, left: 180, background: '#c0392b' }} />
      <div className="zone-map-dot" style={{ top: 280, left: 90, background: '#c0392b' }} />
      <div className="zone-map-dot" style={{ top: 110, left: 500, background: '#2b6cb0' }} />

      <div className="zone-map-legend">
        <h3>Live dispatch</h3>
        <p><span className="zone-legend-swatch zone-legend-balanced" /> Balanced load</p>
        <p><span className="zone-legend-swatch zone-legend-overloaded" /> Overloaded zone</p>
        <p><span className="zone-legend-truck">🚛</span> Active collector</p>
        <p className="zone-map-legend-note">
          Routing Agent balancing <strong>{activeTrucks || 4} trucks</strong> across{' '}
          <strong>{totalPickups || 50} pickups</strong> today.
        </p>
      </div>

      <div className="zone-map-zoom">
        <button type="button" aria-label="Zoom in">+</button>
        <button type="button" aria-label="Zoom out">−</button>
      </div>
    </div>
  )
}
