import { useState } from 'react'
import CollectorRouteMap from '../components/collector/CollectorRouteMap'
import PickupLocationPicker from '../components/map/PickupLocationPicker'

const stops = [
  { id: 'sample-route-1', status: 'Completed', pending: false, pickup: {
    description: 'Bottles & cardboard', address: 'Sample stop · Colombo 07', latitude: 6.9108, longitude: 79.8696,
  } },
  { id: 'sample-route-2', status: 'Pending', pending: true, pickup: {
    description: 'Garden clippings', address: 'Sample stop · Colombo 08', latitude: 6.9174, longitude: 79.8812,
  } },
  { id: 'sample-route-3', status: 'Pending', pending: true, pickup: {
    description: 'Paper & packaging', address: 'Sample stop · Colombo 04',
  } },
]

export default function MapPreview() {
  const [point, setPoint] = useState({})
  const [message, setMessage] = useState('')
  return <main className="admin-console" style={{ display: 'block', padding: 'clamp(16px, 3vw, 40px)', maxWidth: 1100, margin: 'auto' }}>
    <p>Development preview · Sample stops · No account changes</p>
    <h1>Collection route</h1>
    <CollectorRouteMap stops={stops} positions={new Map(stops.map((s, i) => [s.id, i + 1]))}
      onOpen={(s) => setMessage(`Opened ${s.pickup.description}. Live stops open the route details.`)}
      onComplete={() => setMessage('Sample preview is read-only. Log in to record a collection.')}
      onMissed={() => setMessage('Sample preview is read-only. Log in to report a missed collection.')} />
    <p role="status">{message}</p>
    <h2>Booking pin picker</h2>
    <PickupLocationPicker value={point} onChange={setPoint} />
  </main>
}
