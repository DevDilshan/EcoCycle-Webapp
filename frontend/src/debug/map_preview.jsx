import { useState } from 'react'
import CollectorRouteMap from '../components/collector/CollectorRouteMap'
import PickupLocationPicker from '../components/map/PickupLocationPicker'
import ZoneBoundaryEditor from '../components/admin/ZoneBoundaryEditor'
import { boundaryCenter } from '../lib/zoneBoundary'

const demoBoundary = JSON.stringify({ type: 'Polygon', coordinates: [[[79.858, 6.902], [79.888, 6.902], [79.888, 6.935], [79.858, 6.935], [79.858, 6.902]]] })

const stops = [
  { id: 'sample-route-1', status: 'Completed', pending: false, pickup: {
    zoneId: 'demo-area',
    description: 'Bottles & cardboard', address: 'Sample stop · Colombo 07', latitude: 6.9108, longitude: 79.8696,
  } },
  { id: 'sample-route-2', status: 'Pending', pending: true, pickup: {
    zoneId: 'demo-area',
    description: 'Garden clippings', address: 'Sample stop · Colombo 08', latitude: 6.9174, longitude: 79.8812,
  } },
  { id: 'sample-route-3', status: 'Pending', pending: true, pickup: {
    zoneId: 'demo-area',
    description: 'Paper & packaging', address: 'Sample stop · Colombo 04',
  } },
]

export default function MapPreview() {
  const [point, setPoint] = useState({ zoneId: 'demo-area' })
  const [message, setMessage] = useState('')
  const [boundary, setBoundary] = useState(demoBoundary)
  const [reference, setReference] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [pendingDraft, setPendingDraft] = useState(false)
  const zone = { id: 'demo-area', name: 'Demo collection area', boundaryGeoJson: boundary, ...(boundary ? boundaryCenter(boundary) : { latitude: 6.917, longitude: 79.875 }) }
  return <main className="admin-console" style={{ display: 'block', padding: 'clamp(16px, 3vw, 40px)', maxWidth: 1100, margin: 'auto' }}>
    <p>Development preview · Sample stops and editable draft · No account changes. {reference ? 'The selected administrative outline is reference data; council collection coverage still needs review.' : 'The initial demo outline is illustrative. Browse administrative areas to try published reference data.'}</p>
    <h1>Collection boundary editor</h1>
    <ZoneBoundaryEditor value={boundary} center={zone} reference={reference} coverageConfirmed={confirmed}
      onCoverageChange={setConfirmed} onDrawingChange={setPendingDraft}
      onChange={(json, _center, source) => { setBoundary(json); setReference(source) }} />
    <p role="status">{pendingDraft ? 'Finish the draft selection or drawing before saving.' : reference && !confirmed ? 'Coverage review required before a real zone can be saved.' : 'Draft ready. This preview never saves to the API.'}</p>
    <h1>Collection route</h1>
    <CollectorRouteMap stops={stops} zones={[zone]} positions={new Map(stops.map((s, i) => [s.id, i + 1]))}
      onOpen={(s) => setMessage(`Opened ${s.pickup.description}. Live stops open the route details.`)}
      onComplete={() => setMessage('Sample preview is read-only. Log in to record a collection.')}
      onMissed={() => setMessage('Sample preview is read-only. Log in to report a missed collection.')} />
    <p role="status">{message}</p>
    <h2>Booking pin picker</h2>
    <label className="ac-field">Collection zone<select value={point.zoneId ?? ''} onChange={e => setPoint(p => ({ ...p, zoneId: e.target.value }))}>
      <option value="">Choose a zone or place a pin</option><option value="demo-area">Demo collection area</option>
    </select></label>
    <PickupLocationPicker value={point} zone={point.zoneId === zone.id ? zone : undefined} zones={[zone]} onChange={p => setPoint(prev => ({ ...prev, ...p }))} />
  </main>
}
