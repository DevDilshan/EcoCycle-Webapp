import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../lib/api'
import { pickupLabel, profileLabel as profileLabelFor, toSelectOptions } from '../lib/catalog'

// Statuses worth loading for the admin screens. Completed pickups are left out:
// nothing on these pages acts on them, and they grow without bound.
const PICKUP_STATUSES = ['Pending', 'Classified', 'Approved', 'Scheduled']

// Only approved pickups can be given a route assignment, which is what the
// pickup dropdown on the Routes page is for.
const ROUTABLE_STATUS = 'Approved'

/**
 * Shared reference data for the admin screens: profiles, zones and pickups,
 * loaded once per page and exposed both as lists and as lookup maps.
 *
 * Five admin pages each need the same handful of lookups (who is this resident?
 * what zone is that?), so they share one hook rather than each fetching the same
 * three endpoints. Everything is fetched together and `refresh()` reloads it all,
 * which keeps the pages from showing a half-updated view.
 */
export function useAdminCatalog() {
  const [profiles, setProfiles] = useState([])
  const [collectors, setCollectors] = useState([])
  const [zones, setZones] = useState([])
  const [pickups, setPickups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [residentList, collectorList, zoneList, pickupLists] = await Promise.all([
        apiRequest('/profiles?role=resident'),
        apiRequest('/profiles?role=collector'),
        apiRequest('/zones'),
        Promise.all(
          PICKUP_STATUSES.map(async (status) => {
            const query = new URLSearchParams({ pageSize: '100', status })
            const data = await apiRequest(`/pickuprequests?${query}`)
            return data.items ?? []
          }),
        ),
      ])

      const residents = asArray(residentList)
      const collectorProfiles = asArray(collectorList)

      setProfiles([...residents, ...collectorProfiles])
      setCollectors(collectorProfiles)
      setZones(asArray(zoneList))

      // One pickup can come back under more than one status query only if it
      // changed mid-load, so de-duplicate by id and keep the last seen.
      const merged = pickupLists.flat()
      setPickups([...new Map(merged.map((p) => [p.id, p])).values()])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Callers look profiles up by id (`profileMap.get(pickup.residentId)`), so a
  // Map rather than a plain object.
  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  )

  const zoneMap = useMemo(
    () => new Map(zones.map((zone) => [zone.id, zone])),
    [zones],
  )

  const residentOptions = useMemo(
    () => toSelectOptions(profiles.filter(isResident), profileLabelFor),
    [profiles],
  )

  const collectorOptions = useMemo(
    () => toSelectOptions(collectors, profileLabelFor),
    [collectors],
  )

  const zoneOptions = useMemo(
    () => toSelectOptions(zones, (zone) => zone.name || zone.id),
    [zones],
  )

  const pickupOptions = useMemo(
    () =>
      toSelectOptions(
        pickups.filter((pickup) => pickup.status === ROUTABLE_STATUS),
        (pickup) =>
          pickupLabel(pickup, {
            residentName: shortNameFor(profileMap.get(pickup.residentId)),
          }),
      ),
    [pickups, profileMap],
  )

  /**
   * Display name for a resident id. Note this takes an id, unlike the
   * profileLabel exported from lib/catalog, which takes a profile object.
   */
  const profileLabel = useCallback(
    (profileId) => profileLabelFor(profileMap.get(profileId)),
    [profileMap],
  )

  const getPickupsForResident = useCallback(
    (residentId) => pickups.filter((pickup) => pickup.residentId === residentId),
    [pickups],
  )

  return {
    profiles,
    profileMap,
    profileLabel,
    residentOptions,
    collectors,
    collectorOptions,
    zones,
    zoneMap,
    zoneOptions,
    pickups,
    pickupOptions,
    getPickupsForResident,
    loading,
    error,
    refresh,
  }
}

// The profiles endpoint returns a bare array today, but paged endpoints on this
// API return { items }. Accept either so a later change to paging does not empty
// every admin dropdown without warning.
function asArray(payload) {
  if (Array.isArray(payload)) return payload
  return payload?.items ?? []
}

// "resident" and "user" are the same thing: "user" is the fallback role for an
// account whose role was never set. The profiles endpoint already treats them as
// equivalent when filtering.
function isResident(profile) {
  const role = profile?.role?.toLowerCase()
  return role === 'resident' || role === 'user'
}

function shortNameFor(profile) {
  if (!profile) return undefined
  return profile.fullName?.trim() || profile.email
}
