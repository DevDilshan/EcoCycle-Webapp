const EPS = 1e-10
const turn = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
const onSegment = (p, a, b) => Math.abs(turn(a, b, p)) <= EPS && p[0] >= Math.min(a[0], b[0]) - EPS && p[0] <= Math.max(a[0], b[0]) + EPS && p[1] >= Math.min(a[1], b[1]) - EPS && p[1] <= Math.max(a[1], b[1]) + EPS
const intersects = (a, b, c, d) => onSegment(a, c, d) || onSegment(b, c, d) || onSegment(c, a, b) || onSegment(d, a, b) || (turn(a, b, c) > 0) !== (turn(a, b, d) > 0) && (turn(c, d, a) > 0) !== (turn(c, d, b) > 0)
const crosses = (a, b) => a.slice(0, -1).some((p, i) => b.slice(0, -1).some((q, j) => intersects(p, a[i + 1], q, b[j + 1])))
function inRing(point, ring) {
  let inside = false
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i], b = ring[i + 1]
    if (onSegment(point, a, b)) return 2
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside ? 1 : 0
}

/** Accept a single geometry, Feature, or one-feature collection. Never invent borders from a city name. */
export function normalizeBoundary(input) {
  if (typeof input === 'string' && input.length > 64000) throw new Error('Simplify the boundary to less than 64 KB.')
  let geometry
  try { geometry = typeof input === 'string' ? JSON.parse(input) : input }
  catch { throw new Error('That file is not valid GeoJSON.') }
  if (geometry?.type === 'FeatureCollection') {
    if (geometry.features?.length !== 1) throw new Error('Import one area at a time: use a single Feature or Polygon.')
    geometry = geometry.features[0]
  }
  if (geometry?.type === 'Feature') geometry = geometry.geometry
  if (!['Polygon', 'MultiPolygon'].includes(geometry?.type)) throw new Error('Use a GeoJSON Polygon or MultiPolygon.')
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  if (!Array.isArray(polygons) || polygons.length < 1 || polygons.length > 20) throw new Error('A boundary needs 1 to 20 polygons.')
  let count = 0
  for (const rings of polygons) {
    if (!Array.isArray(rings) || rings.length < 1 || rings.length > 20) throw new Error('A polygon needs an outer ring and at most 20 rings.')
    for (const ring of rings) {
      if (!Array.isArray(ring) || ring.length < 4) throw new Error('Draw at least three corners and close the boundary.')
      let area = 0
      for (const p of ring) {
        if (++count > 1000) throw new Error('Simplify to at most 1,000 positions.')
        if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90) throw new Error('Use valid [longitude, latitude] coordinate pairs.')
      }
      if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) throw new Error('Every coordinate ring must be closed.')
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i], b = ring[i + 1]
        if (a[0] === b[0] && a[1] === b[1]) throw new Error('Remove repeated neighbouring corners.')
        if (Math.abs(a[0] - b[0]) > 180) throw new Error('Boundaries crossing the antimeridian are not supported.')
        area += a[0] * b[1] - b[0] * a[1]
        for (let j = i + 2; j < ring.length - 1; j++) if (!(i === 0 && j === ring.length - 2) && intersects(a, b, ring[j], ring[j + 1])) throw new Error('Boundary edges must not cross or touch. Move a corner or undo it.')
      }
      if (Math.abs(area) < EPS) throw new Error('A boundary must enclose an area.')
    }
    for (let h = 1; h < rings.length; h++) {
      if (inRing(rings[h][0], rings[0]) !== 1 || crosses(rings[h], rings[0])) throw new Error('Holes must sit strictly inside the outer boundary.')
      for (let j = 1; j < h; j++) if (crosses(rings[h], rings[j]) || inRing(rings[h][0], rings[j]) !== 0 || inRing(rings[j][0], rings[h]) !== 0) throw new Error('Boundary holes must not touch or overlap.')
    }
  }
  const json = JSON.stringify({ type: geometry.type, coordinates: geometry.coordinates })
  if (json.length > 64000) throw new Error('Simplify the boundary to less than 64 KB.')
  return json
}

export function boundaryGeometry(zone) {
  if (!zone?.boundaryGeoJson) return null
  try { return JSON.parse(zone.boundaryGeoJson) } catch { return null }
}
export function boundaryPolygons(zone) {
  const g = boundaryGeometry(zone)
  const polygons = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : []
  return polygons.map(rings => rings.map(ring => ring.map(([lng, lat]) => [lat, lng])))
}
export function boundaryPoints(zone) { return boundaryPolygons(zone).flatMap(rings => rings[0]) }
export function zoneContains(zone, point) {
  if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || !boundaryGeometry(zone)) return null
  const p = [point.longitude, point.latitude]
  return boundaryPolygons(zone).some(rings => {
    const xy = rings.map(ring => ring.map(([lat, lng]) => [lng, lat]))
    return inRing(p, xy[0]) !== 0 && xy.slice(1).every(r => inRing(p, r) === 0)
  })
}
export function matchingZones(zones, point) { return zones.filter(z => z.isActive !== false && zoneContains(z, point) === true) }
export function boundaryCenter(json) {
  const zone = { boundaryGeoJson: json }
  const points = boundaryPoints(zone)
  const latitudes = points.map(p => p[0]), longitudes = points.map(p => p[1])
  const point = { latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2, longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2 }
  return zoneContains(zone, point) ? point : { latitude: points[0][0], longitude: points[0][1] }
}
