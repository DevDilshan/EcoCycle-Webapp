import { useEffect, useRef } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Central Colombo, used only when no zone has coordinates and the map would
// otherwise have nothing to centre on.
const FALLBACK_CENTRE = [6.9271, 79.8612]

// Keeps the markers clear of the map edge and of the zoom control in the
// top-left, so a zone pinned near the boundary is still fully visible.
const FIT_PADDING = [70, 70]

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
 * Tells Leaflet to re-measure its container.
 *
 * Leaflet reads the container size once at init. If the map mounts inside a
 * panel that is still laying out -- or one that is hidden and later revealed --
 * it measures zero and lays the tiles out against the wrong dimensions, which
 * looks like a skewed or offset grid. The ResizeObserver also covers the
 * sidebar collapsing and the window changing size.
 */
function KeepSized() {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()

    // After the first paint, so the panel has its real height by now.
    const initial = requestAnimationFrame(() => map.invalidateSize())

    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(container)

    return () => {
      cancelAnimationFrame(initial)
      observer.disconnect()
    }
  }, [map])

  return null
}

/**
 * Frames the map around the markers, once per set of coordinates.
 *
 * `points` is rebuilt on every render, so depending on the array itself would
 * re-run this effect each time the parent re-renders -- snapping the view back
 * and undoing whatever the user had just dragged. Keying on the coordinates
 * themselves means the map is framed when the zones first load (or genuinely
 * change) and left alone after that.
 */
function FitToMarkers({ points }) {
  const map = useMap()
  const pointsKey = JSON.stringify(points)
  const lastFitted = useRef(null)

  useEffect(() => {
    if (points.length === 0) return
    if (lastFitted.current === pointsKey) return
    lastFitted.current = pointsKey

    if (points.length === 1) {
      map.setView(points[0], 13)
      return
    }
    map.fitBounds(L.latLngBounds(points), { padding: FIT_PADDING, maxZoom: 13 })
    // `points` is intentionally not a dependency; pointsKey stands in for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, pointsKey])

  return null
}

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
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
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
