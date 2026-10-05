import { useEffect, useState } from 'react'
import { CircleMarker, MapContainer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Navigation, RotateCcw, LocateFixed } from 'lucide-react'
import { FitToMarkers, KeepSized, OsmTileLayer } from '../map/leafletShared'
import { FALLBACK_CENTRE } from '../map/mapConfig'
import { deviceLocation, pickupDirections, pickupPoint } from '../../lib/mapLocation'
import '../../styles/pickup-map.css'

function Controls({ points, selected, onError }) {
  const map = useMap()
  const [location, setLocation] = useState(null)
  const [busy, setBusy] = useState(false)
  const selectedKey = selected?.join(',')
  useEffect(() => {
    if (selectedKey) map.setView(selectedKey.split(',').map(Number), 16)
  }, [map, selectedKey])
  async function locate() {
    setBusy(true)
    try { const point = await deviceLocation(); setLocation(point); map.setView(point, 16) }
    catch (error) { onError(error.message) }
    finally { setBusy(false) }
  }
  return <>
    <div className="pickup-map-controls">
      <button type="button" onClick={() => {
        if (points.length > 1) map.fitBounds(points, { padding: [50, 50], maxZoom: 16 })
        else if (points.length) map.setView(points[0], 16)
      }} disabled={!points.length} aria-label="Fit all stops"><RotateCcw size={18} /></button>
      <button type="button" onClick={locate} disabled={busy} aria-label="My location"><LocateFixed size={18} /></button>
    </div>
    {location && <CircleMarker center={location} radius={8} pathOptions={{ color: '#fff', fillColor: '#2B6CB0', fillOpacity: 1, weight: 3 }} />}
  </>
}

export default function CollectorRouteMap({ stops, positions, onOpen, onComplete, onMissed }) {
  const [selectedId, setSelectedId] = useState(null)
  const [error, setError] = useState('')
  const selected = stops.find((s) => s.id === selectedId) ?? stops.find((s) => s.pending) ?? stops[0]
  const pinned = stops.filter((s) => pickupPoint(s.pickup))
  const points = pinned.map((s) => pickupPoint(s.pickup))
  const directions = pickupDirections(selected?.pickup)
  return <section className="collector-route-map" aria-label="Today's stop map">
    <div className="pickup-map-heading"><strong>Today on the map</strong><span>{pinned.length} of {stops.length} stops pinned</span></div>
    <div className="collector-map-canvas">
      <MapContainer center={points[0] ?? FALLBACK_CENTRE} zoom={14} scrollWheelZoom>
        <OsmTileLayer onError={() => setError('Map tiles unavailable. Stop details and directions still work.')} />
        <KeepSized /><FitToMarkers points={points} singleZoom={16} maxZoom={16} />
        <Controls points={points} selected={selectedId ? pickupPoint(selected?.pickup) : null} onError={setError} />
        {pinned.map((stop) => <Marker key={stop.id} position={pickupPoint(stop.pickup)}
          icon={L.divIcon({ className: 'pickup-stop-marker', iconSize: [40, 40],
            html: `<span class="pickup-pin ${stop.status.toLowerCase()} ${selected?.id === stop.id ? 'selected' : ''}">${positions.get(stop.id)}</span>` })}
          eventHandlers={{ click: () => setSelectedId(stop.id) }}>
          <Popup><strong>Stop {positions.get(stop.id)}</strong><p>{stop.pickup?.address}</p>
            <button type="button" onClick={() => onOpen(stop)}>Open stop</button></Popup>
        </Marker>)}
      </MapContainer>
    </div>
    {error && <p role="status" className="pickup-map-notice">{error}</p>}
    {!pinned.length && <p className="pickup-map-notice">These bookings have no pickup pins yet. Directions use the saved addresses.</p>}
    <div className="pickup-map-stop-list" aria-label="Select a stop">
      {stops.map((stop) => <button type="button" key={stop.id} aria-pressed={selected?.id === stop.id}
        onClick={() => setSelectedId(stop.id)}>Stop {positions.get(stop.id)}{!pickupPoint(stop.pickup) && ' · no pin'}</button>)}
    </div>
    {selected && <div className="pickup-map-selected">
      <div><strong>{selected.pickup?.description || `Stop ${positions.get(selected.id)}`}</strong>
        <p>{selected.pickup?.address || 'Address not provided'}</p>
        <small>{selected.status} · {pickupPoint(selected.pickup) ? 'Pickup pin confirmed' : 'Address only · no pin'}</small></div>
      <div className="pickup-map-actions">
        {directions && <a className="ac-btn ac-btn-primary" href={directions} target="_blank" rel="noreferrer"><Navigation size={16} />Directions</a>}
        <button className="ac-btn" onClick={() => onOpen(selected)}>Open stop</button>
        {selected.pending && onComplete && onMissed && <>
          <button className="ac-btn" onClick={() => onComplete(selected)}>Mark collected</button>
          <button className="ac-btn" onClick={() => onMissed(selected)}>Couldn’t collect</button>
        </>}
      </div>
    </div>}
  </section>
}
