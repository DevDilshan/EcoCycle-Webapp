import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { MapPin, MapPinOff, Maximize2, Mouse, Search, TriangleAlert, X } from 'lucide-react'
import { KeepSized, OsmTileLayer } from '../map/leafletShared'
import { isTouchDevice } from '../map/mapConfig'
import { publicRequest } from '../../lib/api'
import { pickupPoint } from '../../lib/mapLocation'
import { filterServiceAreas } from '../../lib/serviceAreaSearch'

/**
 * "Where we collect": the active zones on OpenStreetMap, for visitors.
 *
 * Reads the anonymous `/api/zones/public` endpoint, so it works for someone who
 * has never signed in. It shows only a zone's name — no pickup counts,
 * collectors or coordinates — because this is a public page.
 */

// A white Lucide truck inside a racing-green circle, matching .eco-truck-pin.
// Built as a divIcon so the CSS owns the appearance and there is
// no sprite for Vite's asset hashing to lose.
const TRUCK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" ' +
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
  'stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>' +
  '<path d="M15 18H9"/>' +
  '<path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>' +
  '<circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>'

const truckIcon = L.divIcon({
  className: 'eco-truck-pin-wrap',
  html: `<span class="eco-truck-pin">${TRUCK_SVG}</span>`,
  iconSize: [42, 42],
  iconAnchor: [21, 21],
  popupAnchor: [0, -22],
})

// Share an in-flight read across StrictMode mounts and short return visits.
// This caches public zone data only; no resident or collector information.
let zoneRequest
let zoneCache
let zoneCacheTime = 0
function loadZones() {
  if (zoneCache && Date.now() - zoneCacheTime < 60_000) return Promise.resolve(zoneCache)
  if (!zoneRequest) {
    zoneRequest = publicRequest('/zones/public').then((data) => {
      zoneCache = Array.isArray(data) ? data : []
      zoneCacheTime = Date.now()
      return zoneCache
    }).finally(() => { zoneRequest = undefined })
  }
  return zoneRequest
}

function AreaCamera({ selected, points, reset }) {
  const map = useMap()
  useEffect(() => {
    if (selected) map.setView(pickupPoint(selected), 14, { animate: false })
    else if (reset > 0) {
      if (points.length === 1) map.setView(points[0], 13)
      else map.fitBounds(points, { padding: [40, 40], maxZoom: 13 })
    }
  }, [map, selected, points, reset])
  return null
}

export default function ServiceAreasMap() {
  const [zones, setZones] = useState(null)   // null = still loading
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [reset, setReset] = useState(0)
  const [tileState, setTileState] = useState('loading')
  const [query, setQuery] = useState('')
  const mappedZones = useMemo(() => (zones ?? []).filter((zone) => pickupPoint(zone)), [zones])
  const filteredZones = useMemo(() => filterServiceAreas(mappedZones, query), [mappedZones, query])
  const points = useMemo(() => mappedZones.map(pickupPoint), [mappedZones])
  const selected = mappedZones.find((zone) => zone.id === selectedId)

  useEffect(() => {
    let cancelled = false

    loadZones()
      .then((data) => {
        if (!cancelled) setZones(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [attempt])

  if (failed) {
    return (
      <div className="eco-map-note" role="status">
        <TriangleAlert size={18} strokeWidth={2} aria-hidden="true" />
        We could not load the service areas just now. Please try again shortly.
        <button type="button" className="eco-btn eco-btn-primary" onClick={() => {
          setFailed(false); setZones(null); setAttempt((value) => value + 1)
        }}>Try again</button>
      </div>
    )
  }

  if (zones === null) {
    return <div className="eco-areas-map eco-areas-map-loading" aria-busy="true" role="status">Loading collection areas…</div>
  }

  if (mappedZones.length === 0) {
    return (
      <p className="eco-map-note">
        <MapPinOff size={18} strokeWidth={2} aria-hidden="true" />
        We are still mapping our collection areas. Check back soon.
      </p>
    )
  }

  // Dragging a map inside a scrolling page is a trap on a phone: the gesture is
  // the same one used to scroll past it.
  const allowDragging = !isTouchDevice()

  return (
    <>
      <div className="eco-service-layout">
        <aside className="eco-service-sidebar" aria-label="Collection areas">
          <h3>Your neighbourhood?</h3>
          <p>Search for a place, then select it on the map.</p>
          <label className="eco-area-search-label" htmlFor="eco-area-search">Find a collection area</label>
          <div className="eco-area-search">
            <Search size={17} aria-hidden="true" />
            <input id="eco-area-search" type="search" value={query} placeholder="Search city or area" autoComplete="off" onChange={(event) => setQuery(event.target.value)} />
            {query && <button type="button" aria-label="Clear area search" onClick={() => setQuery('')}><X size={16} aria-hidden="true" /></button>}
          </div>
          <span className="eco-area-result-count" role="status">{filteredZones.length} of {mappedZones.length} areas</span>
          <ul className="eco-service-list" aria-label="Matching collection areas" tabIndex={0}>
            {filteredZones.map((zone) => <li key={zone.id}><button type="button" aria-pressed={selectedId === zone.id} onClick={() => { setSelectedId(zone.id); setReset((value) => value + 1) }}>
              <MapPin size={16} aria-hidden="true" />{zone.name}
            </button></li>)}
            {filteredZones.length === 0 && <li className="eco-area-no-results">No areas found. Try a different place name.</li>}
          </ul>
          <button className="eco-service-reset" type="button" onClick={() => { setSelectedId(null); setReset((value) => value + 1) }}>
            <Maximize2 size={16} aria-hidden="true" />Show all areas
          </button>
        </aside>
      <div className="eco-areas-map">
        <MapContainer
          {...(points.length > 1 ? { bounds: points, boundsOptions: { padding: [40, 40], maxZoom: 13 } } : { center: points[0], zoom: 13 })}
          className="eco-areas-map-canvas"
          scrollWheelZoom
          wheelPxPerZoomLevel={100}
          dragging={allowDragging}
          touchZoom
          doubleClickZoom
          zoomControl
          keyboard
        >
          <OsmTileLayer onError={() => setTileState('error')} onLoad={() => setTileState('ready')} />
          <KeepSized />
          <AreaCamera selected={selected} points={points} reset={reset} />

          {mappedZones.map((zone) => (
            <Marker
              key={zone.id}
              position={[zone.latitude, zone.longitude]}
              icon={truckIcon}
              title={zone.name}
              alt={zone.name}
            >
              <Popup>
                <strong>{zone.name}</strong>
                <span>Now serving this area</span>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        {tileState !== 'ready' && <div className="eco-map-status" role="status">{tileState === 'error' ? 'Some map tiles could not load. Area selections are still available.' : 'Loading the street map…'}</div>}
      </div>
      </div>
      <p className="eco-map-help"><Mouse size={16} aria-hidden="true" />Scroll over the map to zoom. On a phone, pinch with two fingers or use + / −.</p>
    </>
  )
}
