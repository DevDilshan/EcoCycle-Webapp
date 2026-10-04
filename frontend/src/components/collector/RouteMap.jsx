import { MapContainer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { FitToMarkers, KeepSized, OsmTileLayer } from '../map/leafletShared'
import { FALLBACK_CENTRE } from '../map/mapConfig'
import { spreadStops } from './spreadStops'

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}

// A tick and a bang, as raw markup: Leaflet's divIcon takes an HTML string, not
// a React node, so these cannot be the <Check> and <X> components the list uses.
// Same shapes, kept in sync by hand.
const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`
const BANG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v9"/><path d="M12 19h.01"/></svg>`

/**
 * A stop on the map.
 *
 * A pending stop carries its number, which is its place in the round, so the map
 * and the list can be read against each other rather than matched up by address.
 *
 * A finished one carries a tick or a bang instead. A round half done should look
 * half done at a glance, and colour alone did not carry that: the "to do" green
 * and the "collected" green are both dark greens a shade apart, which is no
 * difference at all on a phone in daylight -- and none whatsoever to anyone who
 * cannot separate the hues. The glyphs match the icons on the list cards.
 */
function stopIcon({ number, status, isNext }) {
  const tone = status === 'Completed' ? ' is-done'
    : status === 'Missed' ? ' is-missed'
      : isNext ? ' is-next' : ''
  const inner = status === 'Completed' ? CHECK_SVG
    : status === 'Missed' ? BANG_SVG
      : escapeHtml(number)
  return L.divIcon({
    className: 'c-map-marker',
    html: `<span class="c-map-stop${tone}">${inner}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15], // centred on the coordinate, not hanging below it
    popupAnchor: [0, -18],
  })
}

/**
 * The zone centre, deliberately nothing like a stop.
 *
 * A ringed dot rather than a numbered disc: it is an area, not somewhere to
 * drive to, and a collector must never set off towards it thinking it is a
 * pickup. Behind the stops in the stacking order for the same reason.
 */
function zoneIcon(name) {
  return L.divIcon({
    className: 'c-map-marker',
    html: `<span class="c-map-zone" title="${escapeHtml(name)}"></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -16],
  })
}

/**
 * Today's round on OpenStreetMap, with the collector's own zones marked.
 *
 * Stops are placed from their zone's coordinates, not their address: nothing in
 * this system geocodes an address, so the only point a stop has is the centre of
 * the zone it belongs to. That means several stops in one zone land on the same
 * spot, which is why each marker carries its number and its own popup -- without
 * them a zone with four stops would look like one.
 */
export default function RouteMap({ stops = [], zones = [], nextStopId = null, tall = false }) {
  // A zone without coordinates cannot be drawn. Its stops cannot either, which
  // the caller says in words beneath the map rather than silently dropping them.
  const withCoords = stops
    .map((stop, index) => ({ stop, number: index + 1 }))
    .filter(({ stop }) => stop.zoneLatitude != null && stop.zoneLongitude != null)

  // Every stop in a zone shares that zone's centre, so markers drawn on the raw
  // coordinate stack exactly on top of each other and only the last one is
  // visible. Fanned onto a small ring instead, so each stop has its own pin.
  const positions = spreadStops(withCoords.map(({ stop }) => stop))
  const placed = withCoords.map((entry, index) => ({
    ...entry,
    point: positions.get(index),
  }))

  const zonePoints = zones
    .filter((zone) => zone.latitude != null && zone.longitude != null)
    .map((zone) => ({ zone, point: [zone.latitude, zone.longitude] }))

  const points = [
    ...placed.map(({ point }) => point),
    ...zonePoints.map(({ point }) => point),
  ]

  if (points.length === 0) {
    return (
      <p className="ac-empty">
        Nothing to map yet. A stop appears here once its zone has a location.
      </p>
    )
  }

  return (
    <div className={`ac-map${tall ? ' c-map-tall' : ''}`}>
      <MapContainer
        center={points[0] ?? FALLBACK_CENTRE}
        zoom={13}
        className="ac-map-canvas"
        scrollWheelZoom={tall}
      >
        <OsmTileLayer />
        <KeepSized />
        <FitToMarkers points={points} />

        {/* Zones first, so a stop pin is never hidden underneath one. */}
        {zonePoints.map(({ zone, point }) => (
          <Marker key={`zone-${zone.id}`} position={point} icon={zoneIcon(zone.name)}>
            <Popup>
              <div className="ac-pop">
                <strong>{zone.name}</strong>
                <span>Your collection zone</span>
              </div>
            </Popup>
          </Marker>
        ))}

        {placed.map(({ stop, number, point }) => (
          <Marker
            key={stop.id}
            position={point}
            icon={stopIcon({ number, status: stop.status, isNext: stop.id === nextStopId })}
          >
            <Popup>
              <div className="ac-pop">
                <strong>
                  {number}. {stop.pickup?.residentName || stop.pickup?.description || 'Pickup stop'}
                </strong>
                {stop.pickup?.address && <span>{stop.pickup.address}</span>}
                {stop.pickup?.residentPhone && (
                  <a href={`tel:${stop.pickup.residentPhone}`}>{stop.pickup.residentPhone}</a>
                )}
                <span>{stop.status}</span>
                {/* The pin is not the house. Said here rather than left to be
                    discovered by driving to it. */}
                <em>Shown around the zone centre, not at the address.</em>
                {stop.pickup?.address && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.pickup.address)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Navigate
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="ac-map-legend">
        <span><i className="c-lg-next" /> Next stop</span>
        <span><i className="c-lg-todo" /> To do</span>
        <span><i className="c-lg-done" /> Collected</span>
        <span><i className="c-lg-missed" /> Not collected</span>
        <span><i className="c-lg-zone" /> Your zone</span>
      </div>
    </div>
  )
}
