import { useEffect, useState } from 'react'
import { MapContainer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { MapPinOff, TriangleAlert } from 'lucide-react'
import { FitToMarkers, KeepSized, OsmTileLayer } from '../map/leafletShared'
import { FALLBACK_CENTRE, isTouchDevice } from '../map/mapConfig'
import { publicRequest } from '../../lib/api'

/**
 * "Where we collect": the active zones on OpenStreetMap, for visitors.
 *
 * Reads the anonymous `/api/zones/public` endpoint, so it works for someone who
 * has never signed in. It shows only a zone's name — no pickup counts,
 * collectors or coordinates — because this is a public page.
 */

// A white Lucide truck inside a racing-green circle, matching .eco-truck-pin.
// Built as a divIcon so the CSS owns the appearance (and the pulse) and there is
// no sprite for Vite's asset hashing to lose.
const TRUCK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" ' +
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
  'stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>' +
  '<path d="M15 18H9"/>' +
  '<path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>' +
  '<circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>'

function truckIcon(delayMs) {
  return L.divIcon({
    className: 'eco-truck-pin-wrap',
    // The delay staggers the drop-in and the pulse, as in the design.
    html: `<span class="eco-truck-pin" style="--eco-delay:${delayMs}ms">${TRUCK_SVG}</span>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -22],
  })
}

export default function ServiceAreasMap() {
  const [zones, setZones] = useState(null)   // null = still loading
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    publicRequest('/zones/public')
      .then((data) => {
        if (!cancelled) setZones(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (failed) {
    return (
      <p className="eco-map-note">
        <TriangleAlert size={18} strokeWidth={2} aria-hidden="true" />
        We could not load the service areas just now. Please try again shortly.
      </p>
    )
  }

  if (zones === null) {
    return <div className="eco-areas-map eco-areas-map-loading" aria-busy="true" />
  }

  if (zones.length === 0) {
    return (
      <p className="eco-map-note">
        <MapPinOff size={18} strokeWidth={2} aria-hidden="true" />
        We are still mapping our collection areas. Check back soon.
      </p>
    )
  }

  const points = zones.map((zone) => [zone.latitude, zone.longitude])
  // Dragging a map inside a scrolling page is a trap on a phone: the gesture is
  // the same one used to scroll past it.
  const allowDragging = !isTouchDevice()

  return (
    <>
      <div className="eco-areas-map">
        <MapContainer
          center={points[0] ?? FALLBACK_CENTRE}
          zoom={12}
          className="eco-areas-map-canvas"
          // The wheel keeps scrolling the page; the +/- control zooms.
          scrollWheelZoom={false}
          dragging={allowDragging}
          touchZoom={allowDragging}
          doubleClickZoom
          zoomControl
          keyboard
        >
          <OsmTileLayer />
          <KeepSized />
          <FitToMarkers points={points} />

          {zones.map((zone, index) => (
            <Marker
              key={zone.id}
              position={[zone.latitude, zone.longitude]}
              icon={truckIcon(index * 90)}
            >
              <Popup>
                <strong>{zone.name}</strong>
                <span>Now serving this area</span>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* The names repeat as pills so they are readable without the map. */}
      <ul className="eco-area-chips" aria-label="Areas we serve">
        {zones.map((zone) => (
          <li key={zone.id}>{zone.name}</li>
        ))}
      </ul>
    </>
  )
}
