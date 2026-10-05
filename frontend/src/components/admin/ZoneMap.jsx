import { MapContainer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { FitToMarkers, KeepSized, OsmTileLayer } from '../map/leafletShared'
import { FALLBACK_CENTRE } from '../map/mapConfig'
import { useState } from 'react'
import ZoneBoundaryLayer from '../map/ZoneBoundaryLayer'
import { boundaryPoints } from '../../lib/zoneBoundary'

// Lucide's "truck" as raw markup. Leaflet's divIcon takes an HTML string, not a
// React node, so the icon cannot be the <Truck> component the rest of the admin
// uses -- this is the same path data, kept in sync by hand.
const TRUCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}

/**
 * A zone marker: the truck sits in a green disc with a white ring, and the
 * badge carries the number of pickups still waiting. Zones with no collector
 * are amber, so an unstaffed zone is visible without opening its popup.
 */
function zoneIcon({ waiting, unassigned }) {
  const badge = waiting > 0 ? `<span class="ac-load">${waiting}</span>` : ''
  return L.divIcon({
    className: 'ac-truck-marker',
    html: `<span class="ac-truck${unassigned ? ' is-unassigned' : ''}">${TRUCK_SVG}${badge}</span>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20], // centred on the coordinate, not hanging below it
    popupAnchor: [0, -22],
  })
}

/**
 * Active zones plotted on OpenStreetMap.
 *
 * Only zones that are active AND have coordinates get a marker. Deactivated
 * zones are left off deliberately: the two Colombo North rows share identical
 * coordinates, so drawing both would stack one marker invisibly on the other.
 * Anything left off is listed beneath the map by the caller.
 */
export default function ZoneMap({ zones = [], loadByZone = new Map(), collectorName }) {
  const [selectedId, setSelectedId] = useState(null)
  const mappable = zones.filter(
    (zone) => zone.isActive !== false && zone.latitude != null && zone.longitude != null,
  )
  const selected = mappable.find(z => z.id === selectedId)
  const points = (selected ? [selected] : mappable).flatMap(zone => boundaryPoints(zone).length ? boundaryPoints(zone) : [[zone.latitude, zone.longitude]])

  if (mappable.length === 0) {
    return (
      <p className="ac-empty">
        No active zone has coordinates yet. Add a latitude and longitude to a zone to place it here.
      </p>
    )
  }

  return (
    <div className="ac-map">
      <MapContainer
        center={points[0] ?? FALLBACK_CENTRE}
        zoom={12}
        className="ac-map-canvas"
        // Wheel over the map zooms the map. Leaflet only binds the wheel
        // handler to its own container, so the rest of the page scrolls
        // normally; the trade-off is that a wheel gesture that starts over the
        // map zooms instead of scrolling past it.
        scrollWheelZoom
        // Smaller steps per wheel notch, and a short debounce, so zooming feels
        // continuous rather than jumping a whole level per click of the wheel.
        wheelPxPerZoomLevel={120}
        wheelDebounceTime={30}
        zoomSnap={0.25}
        zoomDelta={0.5}
        dragging
        touchZoom
        doubleClickZoom
        zoomControl
        keyboard
      >
        <OsmTileLayer />
        <KeepSized />
        <FitToMarkers points={points} />
        <ZoneBoundaryLayer zones={mappable} selectedId={selectedId} onSelect={zone => setSelectedId(zone.id)} />

        {mappable.map((zone) => {
          const stats = loadByZone.get(zone.id)
          const collector = collectorName ? collectorName(zone) : null
          const waiting = stats?.pendingAssignments ?? 0

          return (
            <Marker
              key={zone.id}
              position={[zone.latitude, zone.longitude]}
              icon={zoneIcon({ waiting, unassigned: !collector })}
              title={`${escapeHtml(zone.name)}, ${waiting} waiting`}
              eventHandlers={{ click: () => setSelectedId(zone.id) }}
            >
              <Popup>
                <div className="ac-pop">
                  <strong>{zone.name}</strong>
                  <p>{zone.boundaryGeoJson ? 'Collection boundary mapped' : 'Center pin only · no boundary yet'}</p>
                  <dl>
                    <dt>Collector</dt>
                    <dd>{collector || 'Not assigned'}</dd>
                    <dt>Waiting</dt>
                    <dd>{stats ? stats.pendingAssignments : '—'}</dd>
                    <dt>Due today</dt>
                    <dd>{stats ? stats.dueToday : '—'}</dd>
                  </dl>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      <div className="ac-map-legend">
        <span><i /> Collector assigned</span>
        <span><i className="u" /> No collector</span>
        <span>Badge = pickups waiting</span>
        {selected && <button type="button" className="ac-btn" onClick={() => setSelectedId(null)}>Show all zones</button>}
      </div>
    </div>
  )
}
