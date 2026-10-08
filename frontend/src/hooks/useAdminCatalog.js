import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { apiRequest } from '../lib/api'
import { pickupLabel, profileLabel as profileLabelFor, toSelectOptions } from '../lib/catalog'

/** Every status an admin screen may look up — loaded once for the whole console. */
const ADMIN_PICKUP_STATUSES = [
  'Pending',
  'Classified',
  'Approved',
  'Scheduled',
  'Rejected',
  'Completed',
]
const ROUTABLE_STATUSES = ['Pending', 'Classified', 'Approved']
const CATALOG_TTL_MS = 45_000

/** @type {{ at: number, data: object } | null} */
let memoryCache = null
/** @type {Promise<object> | null} */
let memoryInflight = null

async function fetchCatalogPayload() {
  const [residentList, collectorList, zoneList, pickupLists] = await Promise.all([
    apiRequest('/profiles?role=resident'),
    apiRequest('/profiles?role=collector'),
    apiRequest('/zones'),
    Promise.all(
      ADMIN_PICKUP_STATUSES.map(async (status) => {
        const query = new URLSearchParams({ pageSize: '100', status })
        const data = await apiRequest(`/pickuprequests?${query}`)
        return data.items ?? []
      }),
    ),
  ])

  const residents = asArray(residentList)
  const collectorProfiles = asArray(collectorList)
  const merged = pickupLists.flat()
  const pickups = [...new Map(merged.map((p) => [p.id, p])).values()]

  return {
    profiles: [...residents, ...collectorProfiles],
    collectors: collectorProfiles,
    zones: asArray(zoneList),
    pickups,
  }
}

function readMemoryCache() {
  if (memoryCache && Date.now() - memoryCache.at < CATALOG_TTL_MS) {
    return memoryCache.data
  }
  return null
}

async function loadCatalog({ force = false } = {}) {
  if (!force) {
    const cached = readMemoryCache()
    if (cached) return cached
    if (memoryInflight) return memoryInflight
  }

  const work = fetchCatalogPayload()
    .then((data) => {
      memoryCache = { at: Date.now(), data }
      return data
    })
    .finally(() => {
      memoryInflight = null
    })

  memoryInflight = work
  return work
}

function applyPayload(setters, data) {
  setters.setProfiles(data.profiles)
  setters.setCollectors(data.collectors)
  setters.setZones(data.zones)
  setters.setPickups(data.pickups)
}

const AdminCatalogContext = createContext(null)

/** Loads profiles, zones and pickups once; shared by every admin route. */
export function AdminCatalogProvider({ children }) {
  const initial = readMemoryCache()
  const [profiles, setProfiles] = useState(initial?.profiles ?? [])
  const [collectors, setCollectors] = useState(initial?.collectors ?? [])
  const [zones, setZones] = useState(initial?.zones ?? [])
  const [pickups, setPickups] = useState(initial?.pickups ?? [])
  const [loading, setLoading] = useState(!initial)
  const [error, setError] = useState(null)

  const refresh = useCallback(async ({ force = false } = {}) => {
    setError(null)
    const cached = !force ? readMemoryCache() : null
    if (cached) {
      applyPayload({ setProfiles, setCollectors, setZones, setPickups }, cached)
      setLoading(false)
      void loadCatalog({ force: true })
        .then((data) => applyPayload({ setProfiles, setCollectors, setZones, setPickups }, data))
        .catch(() => {})
      return
    }

    setLoading(!readMemoryCache())
    try {
      const data = await loadCatalog({ force: true })
      applyPayload({ setProfiles, setCollectors, setZones, setPickups }, data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh({ force: false }).catch(() => {})
  }, [refresh])

  const value = useMemo(() => {
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]))
    const zoneMap = new Map(zones.map((zone) => [zone.id, zone]))
    const residentOptions = toSelectOptions(profiles.filter(isResident), profileLabelFor)
    const collectorOptions = toSelectOptions(collectors, profileLabelFor)
    const zoneOptions = toSelectOptions(zones, (zone) => zone.name || zone.id)
    const pickupOptions = toSelectOptions(
      pickups.filter((pickup) => ROUTABLE_STATUSES.includes(pickup.status)),
      (pickup) =>
        pickupLabel(pickup, {
          residentName: shortNameFor(profileMap.get(pickup.residentId)),
        }),
    )

    return {
      profiles,
      profileMap,
      profileLabel: (profileId) => profileLabelFor(profileMap.get(profileId)),
      residentOptions,
      collectors,
      collectorOptions,
      zones,
      zoneMap,
      zoneOptions,
      pickups,
      pickupOptions,
      getPickupsForResident: (residentId) =>
        pickups.filter((pickup) => pickup.residentId === residentId),
      loading,
      error,
      refresh,
    }
  }, [profiles, collectors, zones, pickups, loading, error, refresh])

  return createElement(AdminCatalogContext.Provider, { value }, children)
}

/**
 * Shared admin reference data. Must be used under {@link AdminCatalogProvider}.
 * Per-page pickup status arguments are ignored — the provider loads the full set once.
 */
export function useAdminCatalog(_pickupStatusesIgnored) {
  const ctx = useContext(AdminCatalogContext)
  if (!ctx) {
    throw new Error('useAdminCatalog must be used within AdminCatalogProvider')
  }
  return ctx
}

/** Show a spinner only when loading and nothing is cached yet for that slice. */
export function catalogZonesPending(catalog) {
  return catalog.loading && catalog.zones.length === 0
}

export function catalogPickupsPending(catalog) {
  return catalog.loading && catalog.pickups.length === 0
}

export function catalogProfilesPending(catalog) {
  return catalog.loading && catalog.profiles.length === 0
}

function asArray(payload) {
  if (Array.isArray(payload)) return payload
  return payload?.items ?? []
}

function isResident(profile) {
  const role = profile?.role?.toLowerCase()
  return role === 'resident' || role === 'user'
}

function shortNameFor(profile) {
  if (!profile) return undefined
  return profile.fullName?.trim() || profile.email
}

export function invalidateAdminCatalogCache() {
  memoryCache = null
  memoryInflight = null
}
