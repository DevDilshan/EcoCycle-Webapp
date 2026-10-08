import { normalizeBoundary } from './zoneBoundary'

export const BOUNDARY_DATASET = {
  id: 'lka-cod-ab-v03', source: 'Survey Department of Sri Lanka', publisher: 'UN OCHA / HDX',
  url: 'https://data.humdata.org/dataset/cod-ab-lka', boundaryDate: '2022-08-02', reviewDate: '2025-10-30',
}
// The outlines are about 20 MB, so they live in a public storage bucket, not in
// the repository (scripts/upload_boundaries.py puts them there).
const BOUNDARY_DATA_URL = (import.meta.env.VITE_BOUNDARY_DATA_URL
  || `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/boundary-data/sri-lanka-boundaries`).replace(/\/+$/, '')
const requests = new Map()
export function loadBoundaryData(file) {
  if (!/^(manifest\.json|ds\.geojson|LK\d{2}\.geojson)$/.test(file)) return Promise.reject(new Error('Choose a valid boundary dataset.'))
  if (!requests.has(file)) {
    const request = fetch(`${BOUNDARY_DATA_URL}/${file}`)
      .then(response => { if (!response.ok) throw new Error('Boundary data could not load. Retry or import a known GeoJSON file.'); return response.json() })
      .catch(error => { requests.delete(file); throw error })
    requests.set(file, request)
  }
  return requests.get(file)
}
export function filterAdministrativeAreas(features, districtCode, query) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return features.filter(({ properties: p }) => p.districtCode === districtCode && terms.every(term =>
    [p.name, p.code, p.division, p.nameSi, p.nameTa].filter(Boolean).join(' ').toLocaleLowerCase().includes(term)))
}
export function administrativeDraft(feature) {
  const p = feature?.properties
  if (!p || ![3, 4].includes(p.level) || !/^LK\d{4}(\d{3})?$/.test(p.code) || p.code.length !== (p.level === 3 ? 6 : 9))
    throw new Error('That record is missing its administrative area reference.')
  return { boundaryGeoJson: normalizeBoundary(feature), boundaryReference: {
    datasetId: BOUNDARY_DATASET.id, areaCode: p.code, areaName: p.name,
    administrativeLevel: p.level, adjustedByAdmin: false,
  } }
}
