/**
 * Spreading stops that share a coordinate.
 *
 * Nothing in this system geocodes a street address, so a stop's only point is
 * the centre of its zone. Every stop in one zone therefore has the *same*
 * coordinate, and markers drawn at the same coordinate sit exactly on top of one
 * another -- a round of eight stops in Dehiwala showed a single pin, and the
 * "to do", "collected" and "not collected" colours were invisible underneath it.
 *
 * Each group is laid out on a small ring around its shared centre, so every stop
 * gets its own reachable marker. The positions are deliberately not presented as
 * real locations: the zone marker stays exactly on the centre, and the callers
 * say in words that stops are shown around their zone.
 */

/** Degrees of latitude ~ 110km, so this ring is roughly 300m across. */
const RING_RADIUS_DEG = 0.0027

/** Beyond this many in one ring the markers touch, so a second ring starts. */
const PER_RING = 8

/**
 * Lay a group of stops out around the point they share.
 *
 * Deterministic in the stop's index, so a marker does not jump between renders
 * or move when the round reloads -- a pin that wanders is worse than one that is
 * merely approximate.
 *
 * @param {Array<{latitude: number, longitude: number}>} points
 *   one entry per stop, all with the same coordinate
 * @returns {Array<[number, number]>} a [lat, lng] per input, in the same order
 */
export function fanOut(points) {
  if (points.length === 0) return []
  // A lone stop sits exactly on its zone's centre: there is nothing to separate
  // it from, and offsetting it would only misplace it.
  if (points.length === 1) return [[points[0].latitude, points[0].longitude]]

  const { latitude, longitude } = points[0]
  // Longitude degrees shrink towards the poles, so the ring would be an ellipse
  // without this -- noticeably squashed even at Sri Lanka's latitude.
  const lngScale = 1 / Math.max(Math.cos((latitude * Math.PI) / 180), 0.1)

  return points.map((_, index) => {
    const ring = Math.floor(index / PER_RING) + 1
    const inRing = index % PER_RING
    const count = Math.min(PER_RING, points.length - (ring - 1) * PER_RING)
    // Each ring is turned half a step so an outer marker never hides directly
    // behind an inner one.
    const angle = (inRing / count) * 2 * Math.PI + (ring - 1) * (Math.PI / PER_RING)
    const radius = RING_RADIUS_DEG * ring
    return [
      latitude + radius * Math.sin(angle),
      longitude + radius * Math.cos(angle) * lngScale,
    ]
  })
}

/**
 * Positions for a whole round, grouping by shared coordinate first.
 *
 * @param {Array<{zoneLatitude: number, zoneLongitude: number}>} stops
 *   only stops that have coordinates
 * @returns {Map<number, [number, number]>} keyed by each stop's index in `stops`
 */
export function spreadStops(stops) {
  const groups = new Map()
  stops.forEach((stop, index) => {
    // Rounded, because two zones at the same place in the database can differ in
    // the last decimal and would then not be grouped at all.
    const key = `${stop.zoneLatitude.toFixed(5)},${stop.zoneLongitude.toFixed(5)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(index)
  })

  const positions = new Map()
  groups.forEach((indexes) => {
    const placed = fanOut(
      indexes.map((i) => ({
        latitude: stops[i].zoneLatitude,
        longitude: stops[i].zoneLongitude,
      })),
    )
    indexes.forEach((stopIndex, n) => positions.set(stopIndex, placed[n]))
  })
  return positions
}
