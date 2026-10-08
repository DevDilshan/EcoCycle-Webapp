import { useEffect, useState } from 'react'
import { CircleMarker, MapContainer, useMap, useMapEvents } from 'react-leaflet'
import { KeepSized, OsmTileLayer } from './leafletShared'
import { FALLBACK_CENTRE } from './mapConfig'
import { deviceLocation, pickupPoint } from '../../lib/mapLocation'
import ZoneBoundaryLayer from './ZoneBoundaryLayer'
import { boundaryPoints, matchingZones, zoneContains } from '../../lib/zoneBoundary'
import '../../styles/pickup-map.css'

function PickPoint({ onChange }) {
  useMapEvents({ click: ({ latlng }) => onChange({ latitude: latlng.lat, longitude: latlng.lng }) })
  return null
}

function Locate({ onChange, onError }) {
  const map = useMap()
  const [busy, setBusy] = useState(false)
  async function locate() {
    setBusy(true)
    try {
      const point = await deviceLocation()
      map.setView(point, 18)
      onChange({ latitude: point[0], longitude: point[1] })
    } catch (error) { onError(error.message) }
    finally { setBusy(false) }
  }
  return <button type="button" className="pickup-map-locate" onClick={locate} disabled={busy}>
    {busy ? 'Locating…' : 'Use my location'}
  </button>
}

function ZoneCamera({ zone, point }) {
  const map = useMap()
  const key = JSON.stringify([zone?.id, zone?.boundaryGeoJson, zone?.latitude, zone?.longitude])
  useEffect(() => {
    const points = boundaryPoints(zone)
    if (points.length) map.fitBounds(point ? [...points, point] : points, { padding: [24, 24], maxZoom: 16 })
    else map.setView(point ?? pickupPoint(zone) ?? FALLBACK_CENTRE, point ? 18 : 14)
    // A new click places a pin without resetting the user's chosen zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key])
  return boundaryPoints(zone).length ? <button type="button" className="pickup-map-fit-zone" onClick={() => map.fitBounds(boundaryPoints(zone), { padding: [24, 24], maxZoom: 16 })}>Fit collection area</button> : null
}

export default function PickupLocationPicker({ value, zone, zones = [], autoSelect = true, onChange }) {
  const point = pickupPoint(value)
  const center = pickupPoint(zone) ?? FALLBACK_CENTRE
  const [error, setError] = useState('')
  const inside = zoneContains(zone, value)
  const matches = point ? matchingZones(zones, value) : []
  function choose(next) {
    const found = next.latitude != null ? matchingZones(zones, next) : []
    const zoneId = autoSelect && found.length === 1 && zoneContains(zone, next) !== true ? found[0].id : undefined
    onChange(zoneId ? { ...next, zoneId } : next)
  }
  return <div className="pickup-map-picker">
    <p className="ac-field-hint">Pickup pin (optional) · Tap your entrance on the map. Zoom in for accuracy.</p>
    <div className="pickup-map-canvas">
      <MapContainer center={point ?? center} zoom={point ? 18 : 14} scrollWheelZoom>
        <OsmTileLayer onError={() => setError('Map tiles unavailable. You can still book with your full address.')} />
        <KeepSized />
        <ZoneCamera zone={zone} point={point} />
        <ZoneBoundaryLayer zones={zone ? [zone] : zones} selectedId={zone?.id} outside={inside === false} />
        <PickPoint onChange={choose} />
        <Locate onChange={choose} onError={setError} />
        {point && <CircleMarker center={point} radius={9} interactive={false} pathOptions={{ color: '#fff', fillColor: inside === false ? '#b42318' : '#00563B', fillOpacity: 1, weight: 3 }} />}
      </MapContainer>
    </div>
    {error && <p role="status" className="ac-field-error">{error}</p>}
    <p role="status" className={`zone-map-status${inside === false ? ' is-outside' : ''}`}>
      {inside === false ? `This pin is outside ${zone.name}. Move it inside the outline${autoSelect ? ' or choose a different zone' : ''}.`
        : inside === true ? `Inside ${zone.name}.`
        : point && matches.length > 1 ? 'More than one area covers this pin. Choose your collection zone from the list.'
        : zone?.boundaryGeoJson ? 'Tap inside the collection outline to choose your pickup entrance.'
        : zone ? `${zone.name} has no saved boundary yet. Its center pin does not define the service area.`
        : 'Green outlines show collection areas. A unique matching area is selected automatically.'}
    </p>
    <div className="pickup-map-footer">
      <span>{point ? `${point[0].toFixed(5)}, ${point[1].toFixed(5)}` : 'No pickup pin selected'}</span>
      {point && <button type="button" className="ac-btn" onClick={() => onChange({ latitude: null, longitude: null })}>Remove pin</button>}
    </div>
  </div>
}
