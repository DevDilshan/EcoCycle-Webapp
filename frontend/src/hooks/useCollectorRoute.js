import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiRequest } from '../lib/api'
import { formatCompletionStatus, isRoutePending } from '../lib/collector'

async function fetchToday(collectorId) {
  const data = await apiRequest(`/routes/${collectorId}/today`)
  return Array.isArray(data) ? data : data?.items ?? []
}

/**
 * How far ahead the preview looks, in days from tomorrow.
 *
 * Fourteen rather than seven: a fortnight covers the recurring pickups that
 * repeat every other week, which a seven-day window showed on one refresh and
 * hid on the next. The endpoint clamps to 30.
 */
export const UPCOMING_DAYS = 14

/**
 * Stops after today. Separate from the round itself: a failure here costs the
 * collector the preview, not the work in front of them.
 */
async function fetchUpcoming(collectorId) {
  try {
    const data = await apiRequest(`/routes/${collectorId}/upcoming?days=${UPCOMING_DAYS}`)
    return Array.isArray(data) ? data : data?.items ?? []
  } catch {
    return []
  }
}

/**
 * Today's date, re-read when the clock passes midnight.
 *
 * A crew leaves the app open on the dash all shift, and a round that starts
 * before midnight was still showing the previous day's stops the next morning
 * -- the data was fetched once on mount and nothing ever asked again. The
 * returned string changes at midnight, which is enough to make the effects
 * below refetch.
 *
 * The timer is set to the next midnight rather than polling, and is re-armed
 * each time it fires. Date arithmetic across the boundary is done on a real
 * Date so the month and year roll over too.
 */
function useServiceDay() {
  const [day, setDay] = useState(() => new Date().toDateString())

  useEffect(() => {
    const now = new Date()
    const midnight = new Date(now)
    midnight.setHours(24, 0, 0, 0)

    // A second past, so the clock has definitely crossed the boundary when it
    // fires and the new date cannot read as the old one.
    const timer = setTimeout(() => setDay(new Date().toDateString()), midnight - now + 1000)
    return () => clearTimeout(timer)
  }, [day])

  return day
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
  // Changes at midnight, so the round and the upcoming list reload themselves
  // on a screen that was left open overnight.
  const day = useServiceDay()
  const [routes, setRoutes] = useState([])
  const [upcomingRoutes, setUpcomingRoutes] = useState([])
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
  }, [collectorId, day])

  useEffect(() => {
    if (!collectorId) return undefined
    let cancelled = false
    fetchUpcoming(collectorId).then((items) => { if (!cancelled) setUpcomingRoutes(items) })
    return () => { cancelled = true }
  }, [collectorId, day])

  /**
   * Re-read the stops after a write, without disturbing the pickup cache.
   *
   * Both lists, not just today's. Reporting a stop as not collected books the
   * pickup onto a later round, and completing a recurring one creates its next
   * occurrence -- so a write to today's round routinely adds a stop to the
   * upcoming list. Refreshing only today left that new booking invisible until
   * the collector reloaded the whole page.
   */
  const reload = useCallback(async () => {
    if (!collectorId) return
    const [today, ahead] = await Promise.all([
      fetchToday(collectorId),
      fetchUpcoming(collectorId),
    ])
    setRoutes(today)
    setUpcomingRoutes(ahead)
  }, [collectorId])

  /**
   * The stop's own detail, under the `pickup` key the screens already read.
   *
   * The API now sends this on the stop itself, so there is nothing to match up.
   * The shape is kept because the alternative was renaming every read of it
   * across two pages and a sidebar for no gain.
   */
  const decorate = useCallback((route) => ({
    ...route,
    status: formatCompletionStatus(route.completionStatus),
    pending: isRoutePending(route.completionStatus),
    pickup: {
      residentName: route.residentName,
      residentPhone: route.residentPhone,
      address: route.address,
      latitude: route.latitude,
      longitude: route.longitude,
      description: route.description,
      category: route.category,
      confidence: route.confidence,
      zoneName: route.zoneName,
      isBulkRequest: route.isBulkRequest,
      photoUrl: route.photoUrl,
      requestedAt: route.requestedAt,
    },
  }), [])

  /** Stops in timeline order, each marked if it was carried from an earlier day. */
  const stops = useMemo(() => {
    // Today's round also carries anything older still pending, which is
    // deliberate -- but a stop from three days ago must not read as today's.
    const startOfToday = new Date(day)
    startOfToday.setHours(0, 0, 0, 0)

    return routes
      .map((route) => ({
        ...decorate(route),
        carriedOver: new Date(route.scheduledDate) < startOfToday,
      }))
      .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))
  }, [routes, decorate, day])

  /** Stops after today, grouped by day. */
  const upcoming = useMemo(() => {
    const rows = upcomingRoutes
      .map(decorate)
      .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))

    const days = new Map()
    rows.forEach((row) => {
      const key = new Date(row.scheduledDate).toDateString()
      const day = days.get(key) ?? { key, date: row.scheduledDate, stops: [] }
      day.stops.push(row)
      days.set(key, day)
    })
    return [...days.values()]
  }, [upcomingRoutes, decorate])

  const upcomingCount = upcomingRoutes.length

  const counts = useMemo(() => ({
    total: stops.length,
    pending: stops.filter((s) => s.status === 'Pending').length,
    // Pending splits in two, because they are not the same job: one is today's
    // work, the other is a stop an earlier round never got to and which is now
    // the most overdue thing on the list.
    notCollected: stops.filter((s) => s.status === 'Pending' && s.carriedOver).length,
    toDo: stops.filter((s) => s.status === 'Pending' && !s.carriedOver).length,
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

  /** Categories on board, counted from the stops that carry one. */
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

  /**
   * The collector's own zones as points, for the map's zone markers.
   *
   * Derived from the round rather than fetched: the stops already carry their
   * zone's id, name and centre, and a collector's zones are by definition the
   * ones their stops are in. A separate /zones request would ask the server for
   * something it has already sent, and could disagree with it.
   */
  const zonePoints = useMemo(() => {
    const byId = new Map()
    stops.forEach((stop) => {
      if (!stop.zoneId || stop.zoneLatitude == null || stop.zoneLongitude == null) return
      if (byId.has(stop.zoneId)) return
      byId.set(stop.zoneId, {
        id: stop.zoneId,
        name: stop.zoneName || 'Your zone',
        latitude: stop.zoneLatitude,
        longitude: stop.zoneLongitude,
      })
    })
    return [...byId.values()]
  }, [stops])

  /** Stops that cannot be drawn, because their zone was never placed on a map. */
  const unmappedCount = useMemo(
    () => stops.filter((s) => s.latitude == null || s.longitude == null).length,
    [stops],
  )

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
    zonePoints,
    unmappedCount,
    categories,
    loading,
    error,
    setError,
    reload,
    completeStop,
    reportMissed,
  }
}
