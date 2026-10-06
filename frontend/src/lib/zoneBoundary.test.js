import { describe, it, expect } from 'vitest'
import fixture from '../../../test-data/zone-boundaries.json'
import { normalizeBoundary, zoneContains, matchingZones, boundaryPoints, boundaryCenter } from './zoneBoundary'

describe('collection boundaries', () => {
  const zone = { id: 'a', boundaryGeoJson: normalizeBoundary(fixture.geometry) }
  for (const sample of fixture.cases) it(sample.name, () => expect(zoneContains(zone, sample)).toBe(sample.inside))
  it('imports a Feature and a single-feature collection', () => {
    const feature = { type: 'Feature', geometry: fixture.geometry, properties: { name: 'Demo' } }
    expect(normalizeBoundary(feature)).toBe(zone.boundaryGeoJson)
    expect(normalizeBoundary({ type: 'FeatureCollection', features: [feature] })).toBe(zone.boundaryGeoJson)
    expect(() => normalizeBoundary({ type: 'FeatureCollection', features: [feature, feature] })).toThrow(/one area/)
  })
  it('returns all matches instead of silently choosing between overlapping zones', () => {
    const point = fixture.cases[0]
    expect(matchingZones([zone, { ...zone, id: 'b' }], point)).toHaveLength(2)
    expect(matchingZones([{ ...zone, isActive: false }], point)).toHaveLength(0)
    expect(zoneContains({}, point)).toBeNull()
    expect(zoneContains(zone, {})).toBeNull()
    expect(boundaryPoints(zone)[0]).toEqual([6.9, 79.84])
    expect(zoneContains(zone, boundaryCenter(zone.boundaryGeoJson))).toBe(true)
  })
  it('rejects crossed, open, degenerate and out-of-range boundaries', () => {
    const polygon = coordinates => ({ type: 'Polygon', coordinates: [coordinates] })
    for (const ring of [
      [[79,6],[80,7],[79,7],[80,6],[79,6]],
      [[79,6],[80,6],[80,7],[79,7]],
      [[79,6],[80,6],[81,6],[79,6]],
      [[181,6],[182,6],[182,7],[181,6]],
    ]) expect(() => normalizeBoundary(polygon(ring))).toThrow()
  })
})
