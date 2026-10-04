/**
 * Turning a zone's name into a point on the map.
 *
 * Nominatim, the OpenStreetMap search service, because the maps in this app are
 * already OSM tiles through Leaflet -- a pin from one provider on another's
 * tiles can sit visibly off the road it belongs to.
 *
 * No API key, which is why it is used here, but it is a free service with rules:
 * at most one request a second, and no bulk use. Callers must debounce and must
 * not geocode on every keystroke.
 */
const ENDPOINT = 'https://nominatim.openstreetmap.org/search'

/**
 * The country the service operates in.
 *
 * Results are restricted to it rather than merely biased towards it. "Dehiwala"
 * is unambiguous in Sri Lanka and not elsewhere, but plenty of suburb names are
 * shared across countries -- an unrestricted search for "Kandy" or "Galle" can
 * land in the wrong hemisphere, and a zone silently pinned to another continent
 * is worse than one with no pin at all.
 */
const COUNTRY_CODES = 'lk'

/**
 * Find a place by name.
 *
 * @param {string} query the zone's name, as the admin typed it
 * @param {AbortSignal} [signal] so a newer lookup can cancel this one
 * @returns {Promise<{latitude: number, longitude: number, label: string} | null>}
 *   null when nothing matched; throws only when the request itself failed.
 */
export async function geocodePlace(query, signal) {
  const trimmed = (query || '').trim()
  // Two letters cannot identify a place, and asking wastes a request against a
  // rate limit the next real lookup needs.
  if (trimmed.length < 3) return null

  const url = `${ENDPOINT}?${new URLSearchParams({
    q: trimmed,
    format: 'jsonv2',
    limit: '1',
    countrycodes: COUNTRY_CODES,
    // The administrative name, which is what a zone is, rather than a shop or a
    // bus stop that happens to share the name.
    addressdetails: '1',
  })}`

  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`Place lookup failed (${response.status})`)

  const results = await response.json()
  const best = Array.isArray(results) ? results[0] : null
  if (!best) return null

  const latitude = Number(best.lat)
  const longitude = Number(best.lon)
  // A result that does not parse is the same as no result: better to save the
  // zone without a pin than to put one at (NaN, NaN).
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  return {
    latitude,
    longitude,
    label: best.display_name || trimmed,
  }
}
