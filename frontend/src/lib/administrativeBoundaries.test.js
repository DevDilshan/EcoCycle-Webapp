import { describe, expect, it, vi } from 'vitest'
import { administrativeDraft, filterAdministrativeAreas, loadBoundaryData } from './administrativeBoundaries'
import { boundaryCenter, zoneContains } from './zoneBoundary'
import sample from '../../../test-data/sri-lanka-boundary-sample.json'
// A few real areas from the prepared files; the full set is served from storage.
import areas from '../../../test-data/sri-lanka-areas-sample.json'

const colombo = areas.LK11
const gampaha = areas.LK12

describe('administrative boundary drafts', () => {
  it('matches native and API coverage for the published Malabe outline', () => {
    const draft = { boundaryGeoJson: JSON.stringify(sample.geometry) }
    for (const point of sample.cases) expect(zoneContains(draft, point)).toBe(point.inside)
  })
  it('finds named areas in the correct district and preserves their official reference', () => {
    for (const [file, district, name] of [[colombo, 'LK11', 'Malabe'], [gampaha, 'LK12', 'Nittambuwa']]) {
      const features = file
      const matches = filterAdministrativeAreas(features, district, name)
      expect(matches.length).toBeGreaterThan(0)
      const draft = administrativeDraft(matches[0])
      expect(draft.boundaryReference.areaCode).toBe(matches[0].properties.code)
      expect(draft.boundaryReference.administrativeLevel).toBe(4)
      expect(draft.boundaryReference.adjustedByAdmin).toBe(false)
      expect(zoneContains(draft, boundaryCenter(draft.boundaryGeoJson))).toBe(true)
      expect(filterAdministrativeAreas(features, 'LK99', name)).toEqual([])
    }
  })
  it('searches area codes, local names and DS divisions without a geocoding request', () => {
    const features = colombo
    const f = features[0]
    expect(filterAdministrativeAreas(features, f.properties.districtCode, f.properties.code)).toEqual([f])
    expect(filterAdministrativeAreas(features, f.properties.districtCode, f.properties.nameSi)).toContain(f)
    expect(() => administrativeDraft({ ...f, properties: { ...f.properties, code: 'LK12' } })).toThrow(/reference/)
  })
  it('retries failed downloads instead of caching an unavailable catalogue', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({ features: [] }) })
    vi.stubGlobal('fetch', fetch)
    try {
      await expect(loadBoundaryData('LK99.geojson')).rejects.toThrow(/could not load/)
      expect(await loadBoundaryData('LK99.geojson')).toEqual({ features: [] })
      expect(fetch).toHaveBeenCalledTimes(2)
      await expect(loadBoundaryData('../secret')).rejects.toThrow(/valid boundary/)
    } finally { vi.unstubAllGlobals() }
  })
})
