import { useState } from 'react'
import { CircleMarker, MapContainer, useMap, useMapEvents } from 'react-leaflet'
import { FitToMarkers, KeepSized, OsmTileLayer } from './leafletShared'
import { FALLBACK_CENTRE } from './mapConfig'
import { deviceLocation, pickupPoint } from '../../lib/mapLocation'
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

export default function PickupLocationPicker({ value, zone, onChange }) {
  const point = pickupPoint(value)
  const center = pickupPoint(zone) ?? FALLBACK_CENTRE
  const [error, setError] = useState('')
  return <div className="pickup-map-picker">
    <p className="ac-field-hint">Pickup pin (optional) · Tap your entrance on the map. Zoom in for accuracy.</p>
    <div className="pickup-map-canvas">
      <MapContainer center={point ?? center} zoom={point ? 18 : 14} scrollWheelZoom>
        <OsmTileLayer onError={() => setError('Map tiles unavailable. You can still book with your full address.')} />
        <KeepSized />
        <FitToMarkers points={[point ?? center]} singleZoom={point ? 18 : 14} />
        <PickPoint onChange={onChange} />
        <Locate onChange={onChange} onError={setError} />
        {point && <CircleMarker center={point} radius={9} pathOptions={{ color: '#fff', fillColor: '#00563B', fillOpacity: 1, weight: 3 }} />}
      </MapContainer>
    </div>
    {error && <p role="status" className="ac-field-error">{error}</p>}
    <div className="pickup-map-footer">
      <span>{point ? `${point[0].toFixed(5)}, ${point[1].toFixed(5)}` : 'No pickup pin selected'}</span>
      {point && <button type="button" className="ac-btn" onClick={() => onChange({ latitude: null, longitude: null })}>Remove pin</button>}
    </div>
  </div>
}
