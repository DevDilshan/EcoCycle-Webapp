import { useState } from 'react'
import { MapContainer, Marker, Polygon, Polyline, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { FitToMarkers, KeepSized, OsmTileLayer } from '../map/leafletShared'
import ZoneBoundaryLayer from '../map/ZoneBoundaryLayer'
import { FALLBACK_CENTRE } from '../map/mapConfig'
import { pickupPoint } from '../../lib/mapLocation'
import { boundaryPoints, boundaryGeometry, boundaryCenter, normalizeBoundary } from '../../lib/zoneBoundary'
import AdministrativeBoundaryPicker from './AdministrativeBoundaryPicker'
import { administrativeDraft, BOUNDARY_DATASET } from '../../lib/administrativeBoundaries'
import '../../styles/pickup-map.css'

const cornerIcon = L.divIcon({ className: 'zone-corner', html: '<span></span>', iconSize: [18, 18], iconAnchor: [9, 9] })
function DrawClicks({ drawing, onAdd }) {
  useMapEvents({ click: ({ latlng }) => { if (drawing) onAdd([latlng.lat, latlng.lng]) } })
  return null
}

export default function ZoneBoundaryEditor({ value, center, reference, coverageConfirmed = false, onCoverageChange = () => {}, onChange, onDrawingChange = () => {} }) {
  const [drawing, setDrawing] = useState(false)
  const [corners, setCorners] = useState([])
  const [error, setError] = useState('')
  const [paste, setPaste] = useState('')
  const [tileFailed, setTileFailed] = useState(false)
  const [showReferences, setShowReferences] = useState(false)
  const [candidate, setCandidate] = useState(null)
  const zone = { boundaryGeoJson: candidate ? JSON.stringify(candidate.geometry) : value, id: 'draft', name: 'Collection area' }
  const points = boundaryPoints(zone)
  const start = pickupPoint(center) ?? FALLBACK_CENTRE
  const geometry = boundaryGeometry(zone)
  const canEdit = geometry?.type === 'Polygon' && geometry.coordinates.length === 1
  function toggleDrawing(next) { setDrawing(next); onDrawingChange(next) }
  function publish(input, nextReference = null) {
    try {
      const json = normalizeBoundary(input)
      onChange(json, boundaryCenter(json), nextReference); onCoverageChange(false); setCandidate(null); setDrawing(false); onDrawingChange(false); setCorners([]); setError('')
    } catch (e) { setError(e.message) }
  }
  async function importFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 64000) setError('Simplify the file to less than 64 KB.')
    else {
      try { publish(await file.text()) } catch { setError('Could not read that file. Try pasting its GeoJSON below.') }
    }
    event.target.value = ''
  }
  return <section className="zone-boundary-editor" aria-label="Collection boundary editor">
    <strong>Collection boundary</strong>
    <p className="ac-field-hint">Draw the area your team serves, or import a GeoJSON boundary. Place names locate the map; they do not define a city border.</p>
    <button type="button" className="ac-btn" aria-expanded={showReferences} disabled={drawing} onClick={() => { setShowReferences(v => !v); setCandidate(null); onDrawingChange(false) }}>Browse Sri Lankan administrative areas</button>
    {showReferences && <AdministrativeBoundaryPicker selectedCode={candidate?.properties.code}
      onPreview={feature => { try { if (feature) administrativeDraft(feature); setCandidate(feature); onDrawingChange(Boolean(feature)); setError('') } catch (e) { setError(e.message) } }}
      onUse={feature => { try { const draft = administrativeDraft(feature); publish(draft.boundaryGeoJson, draft.boundaryReference); setShowReferences(false) } catch (e) { setError(e.message) } }} />}
    {candidate && <div className="zone-reference-notice"><p role="status">Previewing {candidate.properties.name}. Choose “Use as a starting outline” to replace the draft. It has not been saved.</p><button type="button" className="ac-btn" onClick={() => { setCandidate(null); onDrawingChange(false) }}>Cancel preview</button></div>}
    <div className="zone-boundary-toolbar">
      <button type="button" className="ac-btn" disabled={Boolean(candidate)} onClick={() => { setCorners([]); setError(''); toggleDrawing(true) }}>{value ? 'Redraw area' : 'Draw area'}</button>
      {canEdit && !drawing && <button type="button" className="ac-btn" disabled={Boolean(candidate)} onClick={() => { setCorners(points.slice(0, -1)); toggleDrawing(true) }}>Edit corners</button>}
      {!drawing && value && <button type="button" className="ac-btn" onClick={() => { onChange(null, null, null); onCoverageChange(false); setCandidate(null); onDrawingChange(false); setError('') }}>Remove boundary</button>}
      <label className="ac-btn zone-import">Import GeoJSON<input type="file" accept=".json,.geojson,application/json" aria-label="Import zone GeoJSON" onChange={importFile} /></label>
    </div>
    <div className={`pickup-map-canvas zone-editor-map${drawing ? ' is-drawing' : ''}`}>
      <MapContainer center={start} zoom={14} scrollWheelZoom doubleClickZoom={!drawing}>
        <OsmTileLayer onError={() => setTileFailed(true)} /><KeepSized />
        <FitToMarkers points={points.length ? points : [start]} maxZoom={16} singleZoom={14} padding={[24, 24]} />
        {!drawing && <ZoneBoundaryLayer zones={[zone]} selectedId="draft" />}
        <DrawClicks drawing={drawing} onAdd={p => setCorners(c => [...c, p])} />
        {drawing && corners.length > 1 && (corners.length > 2 ? <Polygon positions={corners} interactive={false} pathOptions={{ color: '#00563b', fillOpacity: .14 }} /> : <Polyline positions={corners} interactive={false} pathOptions={{ color: '#00563b' }} />)}
        {drawing && corners.map((point, i) => <Marker key={i} position={point} icon={cornerIcon} draggable
          eventHandlers={{ dragend: event => { const p = event.target.getLatLng(); setCorners(c => c.map((old, index) => index === i ? [p.lat, p.lng] : old)) } }} />)}
      </MapContainer>
    </div>
    {tileFailed && <p role="status" className="ac-field-hint">Street tiles unavailable. You can still import a known boundary.</p>}
    {drawing ? <>
      <p role="status" className="ac-field-hint">{corners.length} corners · Click to add, drag to adjust. Finish the outline before saving the zone.</p>
      <div className="zone-boundary-toolbar">
        <button type="button" className="ac-btn" disabled={!corners.length} onClick={() => { setCorners(c => c.slice(0, -1)); setError('') }}>Undo corner</button>
        <button type="button" className="ac-btn ac-btn-primary" disabled={corners.length < 3} onClick={() => publish({ type: 'Polygon', coordinates: [[...corners, corners[0]].map(([lat, lng]) => [lng, lat])] }, reference ? { ...reference, adjustedByAdmin: true } : null)}>Finish outline</button>
        <button type="button" className="ac-btn" onClick={() => { toggleDrawing(false); setCorners([]); setError('') }}>Cancel drawing</button>
      </div>
    </> : <p role="status" className="ac-field-hint">{value ? 'Outline ready. Save the zone to publish it.' : 'No boundary yet. This zone uses its center pin and allows address-only bookings.'}</p>}
    {reference && <div className="zone-reference-notice">
      <strong>{reference.areaName} · {reference.administrativeLevel === 4 ? 'GN' : 'DS'} division · {reference.areaCode}</strong>
      <p>Based on a simplified Survey Department outline from <a href={BOUNDARY_DATASET.url} target="_blank" rel="noreferrer">UN OCHA / HDX</a>, dated {BOUNDARY_DATASET.boundaryDate}.{reference.adjustedByAdmin ? ' Adjusted by an admin.' : ''} This reference does not certify cleaning coverage.</p>
      <label className="zone-review-check"><input type="checkbox" checked={coverageConfirmed} onChange={e => onCoverageChange(e.target.checked)} />I checked this outline against the council’s collection area and confirm the team can serve it.</label>
    </div>}
    <details><summary>Paste GeoJSON instead</summary><label className="ac-field">GeoJSON<textarea rows={4} value={paste} onChange={e => setPaste(e.target.value)} /></label><button className="ac-btn" type="button" disabled={!paste.trim()} onClick={() => publish(paste)}>Use pasted boundary</button></details>
    {error && <p role="alert" className="ac-field-error">{error}</p>}
  </section>
}
