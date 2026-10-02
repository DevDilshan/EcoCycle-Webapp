import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiRequest } from '../lib/api'
import { formatCompletionStatus, isRoutePending } from '../lib/collector'

async function fetchToday(collectorId) {
  const data = await apiRequest(`/routes/${collectorId}/today`)
  return Array.isArray(data) ? data : data?.items ?? []
}

/**
 * Stops after today. Separate from the round itself: a failure here costs the
 * collector the preview, not the work in front of them.
 */
async function fetchUpcoming(collectorId) {
  try {
    const data = await apiRequest(`/routes/${collectorId}/upcoming?days=7`)
    return Array.isArray(data) ? data : data?.items ?? []
  } catch {
    return []
  }
}

/**
 * The pickups behind today's stops.
 *
 * A stop carries only ids, so the description, category, confidence and zone
 * name have to come from the pickup. `GET /api/pickuprequests/{id}` is
 * admin/resident only, so the list is fetched once and matched locally.
 *
 * A failure here is swallowed: the round is still drivable with less detail on
 * each card, so it must not blank the page or read as a route error.
 */
async function fetchPickups() {
  try {
    const page = await apiRequest('/pickuprequests?pageSize=100')
    return page?.items ?? []
  } catch {
    return []
  }
}

/**
 * Today's stops for the signed-in collector, joined to their pickup details.
 *
 * CollectorLayout calls this once and shares the result, so the sidebar badge,
 * Overview and Today's route can never disagree about the same round.
 */
export function useCollectorRoute() {
  const { user } = useAuth()
  const collectorId = user?.id
  const [routes, setRoutes] = useState([])
  const [upcomingRoutes, setUpcomingRoutes] = useState([])
  const [pickups, setPickups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!collectorId) return undefined
    let cancelled = false
    fetchToday(collectorId)
      .then((data) => { if (!cancelled) setRoutes(data) })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [collectorId])

  useEffect(() => {
    let cancelled = false
    fetchPickups().then((items) => { if (!cancelled) setPickups(items) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!collectorId) return undefined
    let cancelled = false
    fetchUpcoming(collectorId).then((items) => { if (!cancelled) setUpcomingRoutes(items) })
    return () => { cancelled = true }
  }, [collectorId])

  /** Re-read the stops after a write, without disturbing the pickup cache. */
  const reload = useCallback(async () => {
    if (!collectorId) return
    setRoutes(await fetchToday(collectorId))
  }, [collectorId])

  /** Stops in timeline order, each with its pickup attached when one matched. */
  const stops = useMemo(() => {
    const byId = new Map(pickups.map((pickup) => [pickup.id, pickup]))
    return routes
      .map((route) => ({
        ...route,
        status: formatCompletionStatus(route.completionStatus),
        pending: isRoutePending(route.completionStatus),
        pickup: byId.get(route.pickupRequestId) ?? null,
      }))
      .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))
  }, [routes, pickups])

  /** Stops after today, joined to their pickups and grouped by day. */
  const upcoming = useMemo(() => {
    const byId = new Map(pickups.map((pickup) => [pickup.id, pickup]))
    const rows = upcomingRoutes
      .map((route) => ({
        ...route,
        status: formatCompletionStatus(route.completionStatus),
        pickup: byId.get(route.pickupRequestId) ?? null,
      }))
      .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))

    const days = new Map()
    rows.forEach((row) => {
      const key = new Date(row.scheduledDate).toDateString()
      const day = days.get(key) ?? { key, date: row.scheduledDate, stops: [] }
      day.stops.push(row)
      days.set(key, day)
    })
    return [...days.values()]
  }, [upcomingRoutes, pickups])

  const upcomingCount = upcomingRoutes.length

  const counts = useMemo(() => ({
    total: stops.length,
    pending: stops.filter((s) => s.status === 'Pending').length,
    completed: stops.filter((s) => s.status === 'Completed').length,
    missed: stops.filter((s) => s.status === 'Missed').length,
  }), [stops])

  // Of the stops that can still be acted on, how many are resolved. Missed ones
  // count as resolved: a collector cannot complete them, so leaving them out
  // would make a finished round read as unfinished for ever.
  const percentDone = counts.total
    ? Math.round(((counts.completed + counts.missed) / counts.total) * 100)
    : 0

  /** The next stop to drive to: the earliest one still pending. */
  const nextStop = useMemo(
    () => stops.find((stop) => stop.status === 'Pending') ?? null,
    [stops],
  )

  /** Zones on today's round, with how many stops are left in each. */
  const zones = useMemo(() => {
    const map = new Map()
    stops.forEach((stop) => {
      const name = stop.pickup?.zoneName
      if (!name) return
      const row = map.get(name) ?? { name, total: 0, left: 0 }
      row.total += 1
      if (stop.status === 'Pending') row.left += 1
      map.set(name, row)
    })
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [stops])

  /** Categories on board, counted from the matched pickups only. */
  const categories = useMemo(() => {
    const map = new Map()
    stops.forEach((stop) => {
      const category = stop.pickup?.category
      if (!category) return
      map.set(category, (map.get(category) ?? 0) + 1)
    })
    return [...map.entries()].map(([key, count]) => ({ key, count }))
  }, [stops])

  const zoneNames = useMemo(() => zones.map((zone) => zone.name), [zones])

  /// Report a stop as not collected. A reason is required: "missed" with no
  /// explanation tells the admin nothing and cannot be answered to a resident.
  const reportMissed = useCallback(async (routeId, issueNotes) => {
    const result = await apiRequest(`/routes/${routeId}/missed`, {
      method: 'PATCH',
      body: JSON.stringify({ issueNotes: issueNotes?.trim() || undefined }),
    })
    await reload()
    return result
  }, [reload])

  const completeStop = useCallback(async (routeId, issueNotes) => {
    await apiRequest(`/routes/${routeId}/complete`, {
      method: 'PATCH',
      body: JSON.stringify({ issueNotes: issueNotes?.trim() || undefined }),
    })
    await reload()
  }, [reload])

  return {
    stops,
    upcoming,
    upcomingCount,
    counts,
    percentDone,
    nextStop,
    zones,
    zoneNames,
    categories,
    loading,
    error,
    setError,
    reload,
    completeStop,
    reportMissed,
  }
}
