import { MapContainer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { FitToMarkers, KeepSized, OsmTileLayer } from '../map/leafletShared'
import { FALLBACK_CENTRE } from '../map/mapConfig'

// A divIcon rather than an image: the marker is just an emoji in a styled
// circle, so there is no sprite to load, nothing to go missing under Vite's
// asset hashing, and it scales with the CSS rather than a fixed PNG.
const truckIcon = L.divIcon({
  className: 'zone-marker-truck-wrapper',
  html: '<span class="zone-marker-truck" role="img" aria-label="Collection zone">\u{1F69B}</span>',
  iconSize: [38, 38],
  iconAnchor: [19, 19],   // centred on the coordinate, not hanging below it
  popupAnchor: [0, -20],
})

/**
 * Active zones plotted on OpenStreetMap.
 *
 * Only zones that are active AND have coordinates get a marker. Deactivated
 * zones are left off deliberately: the two Colombo North rows share identical
 * coordinates, so drawing both would stack one marker invisibly on the other.
 * Anything left off is listed beneath the map by the caller.
 */
export default function ZoneMap({ zones = [], loadByZone = new Map() }) {
  const mappable = zones.filter(
    (zone) => zone.isActive !== false && zone.latitude != null && zone.longitude != null,
  )
  const points = mappable.map((zone) => [zone.latitude, zone.longitude])

  if (mappable.length === 0) {
    return (
      <p className="admin-empty">
        No active zone has coordinates yet. Add a latitude and longitude to a zone to place it here.
      </p>
    )
  }

  return (
    <div className="zone-map">
      <MapContainer
        center={points[0] ?? FALLBACK_CENTRE}
        zoom={12}
        className="zone-map-canvas"
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

        {mappable.map((zone) => {
          const stats = loadByZone.get(zone.id)
          return (
            <Marker key={zone.id} position={[zone.latitude, zone.longitude]} icon={truckIcon}>
              <Popup>
                <strong>{zone.name}</strong>
                {zone.description && <div className="zone-map-popup-sub">{zone.description}</div>}
                <div className="zone-map-popup-counts">
                  {stats
                    ? `${stats.pendingAssignments} waiting · ${stats.dueToday} due today`
                    : 'Pickup counts unavailable'}
                </div>
                <div className="zone-map-popup-coords">
                  {zone.latitude}, {zone.longitude}
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
