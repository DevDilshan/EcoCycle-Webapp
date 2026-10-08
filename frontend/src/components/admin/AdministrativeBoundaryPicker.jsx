import { useEffect, useMemo, useState } from 'react'
import { BOUNDARY_DATASET, filterAdministrativeAreas, loadBoundaryData } from '../../lib/administrativeBoundaries'

export default function AdministrativeBoundaryPicker({ onPreview, onUse, selectedCode }) {
  const [district, setDistrict] = useState('LK11')
  const [level, setLevel] = useState('4')
  const [query, setQuery] = useState('')
  const [manifest, setManifest] = useState(null)
  const [features, setFeatures] = useState([])
  const [loadedFile, setLoadedFile] = useState('')
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [limit, setLimit] = useState(100)
  const file = level === '3' ? 'ds.geojson' : `${district}.geojson`
  useEffect(() => {
    let cancelled = false
    Promise.all([loadBoundaryData('manifest.json'), loadBoundaryData(file)])
      .then(([catalog, data]) => { if (!cancelled) { setManifest(catalog); setFeatures(data.features); setLoadedFile(file); setError('') } })
      .catch(e => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [file, retry])
  const ready = loadedFile === file && !error
  const areas = useMemo(() => ready ? filterAdministrativeAreas(features, district, query) : [], [ready, features, district, query])
  const selected = areas.find(f => f.properties.code === selectedCode)
  const omitted = manifest?.excluded.filter(area => area.code.startsWith(district)).length ?? 0
  function changeFilter(setter, value) { setter(value); setLimit(100); onPreview(null) }
  return <div className="administrative-picker">
    <strong>Start from an administrative area</strong>
    <p className="ac-field-hint">Choose a DS division or a smaller GN division. These are administrative borders; check your council’s collection coverage before using them.</p>
    <div className="administrative-filters">
      <label className="ac-field">District<select value={district} onChange={e => changeFilter(setDistrict, e.target.value)}>
        {(manifest?.districts ?? [{ code: 'LK11', name: 'Colombo' }]).map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
      </select></label>
      <label className="ac-field">Area type<select value={level} onChange={e => changeFilter(setLevel, e.target.value)}>
        <option value="4">GN division · smaller area</option><option value="3">DS division · broader area</option>
      </select></label>
    </div>
    <label className="ac-field">Search areas<input type="search" value={query} placeholder="Name, DS division or area code" onChange={e => changeFilter(setQuery, e.target.value)} /></label>
    {error ? <div role="alert"><p>{error}</p><button type="button" className="ac-btn" onClick={() => { setError(''); setLoadedFile(''); setRetry(n => n + 1) }}>Retry</button></div>
      : !ready ? <p role="status">Loading district outlines…</p>
        : <><p className="ac-field-hint" role="status">{areas.length} matching areas · Select one to preview it on the map.</p>
          <div className="administrative-results" aria-label="Administrative areas">
            {areas.slice(0, limit).map(feature => { const p = feature.properties; return <button type="button" key={p.code}
              className={`administrative-result${p.code === selectedCode ? ' is-selected' : ''}`} aria-pressed={p.code === selectedCode} onClick={() => onPreview(feature)}>
              <strong>{p.name}</strong><span>{p.division} · {p.code}</span>
            </button> })}
            {!areas.length && <p>No matching areas. Try another district, name or area code.</p>}
            {areas.length > limit && <button type="button" className="ac-btn" onClick={() => setLimit(n => n + 100)}>Show more areas</button>}
          </div>
        </>}
    {selected && <button type="button" className="ac-btn ac-btn-primary" onClick={() => onUse(selected)}>Use {selected.properties.name} as a starting outline</button>}
    {omitted > 0 && <p className="ac-field-hint">{omitted} complex source outlines in this district need manual import and review; they are excluded from this picker.</p>}
    <p className="ac-field-hint">Simplified for planning · Boundaries dated {BOUNDARY_DATASET.boundaryDate}, dataset reviewed {BOUNDARY_DATASET.reviewDate}. Source: {BOUNDARY_DATASET.source}, published by <a href={BOUNDARY_DATASET.url} target="_blank" rel="noreferrer">{BOUNDARY_DATASET.publisher}</a> (CC BY-IGO).</p>
    <p className="ac-field-hint"><a href="https://www.colombo.mc.gov.lk/garbage-collection.php" target="_blank" rel="noreferrer">Colombo council collection districts and road lists</a> can help with the coverage review. Other districts need their own council’s information.</p>
  </div>
}
