import { useEffect, useRef } from 'react'
import { TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { FIT_PADDING, OSM_ATTRIBUTION, OSM_TILE_URL } from './mapConfig'

/**
 * Pieces shared by every Leaflet map in the app.
 *
 * Extracted from the admin ZoneMap so the public "Where we collect" map behaves
 * identically where it should — sizing, framing and tiles — while differing
 * only where the design asks it to (interaction and marker styling).
 */

/** The OpenStreetMap raster layer, with its required attribution. */
export function OsmTileLayer({ onError }) {
  return <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_TILE_URL} maxNativeZoom={19}
    eventHandlers={onError ? { tileerror: onError } : undefined} />
}

/**
 * Tells Leaflet to re-measure its container.
 *
 * Leaflet reads the container size once at init. If the map mounts inside a
 * panel that is still laying out -- or one that is hidden and later revealed --
 * it measures zero and lays the tiles out against the wrong dimensions, which
 * looks like a skewed or offset grid. The ResizeObserver also covers the
 * sidebar collapsing and the window changing size.
 */
export function KeepSized() {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()

    // After the first paint, so the panel has its real height by now.
    const initial = requestAnimationFrame(() => map.invalidateSize())

    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(container)

    return () => {
      cancelAnimationFrame(initial)
      observer.disconnect()
    }
  }, [map])

  return null
}

/**
 * Frames the map around the markers, once per set of coordinates.
 *
 * `points` is rebuilt on every render, so depending on the array itself would
 * re-run this effect each time the parent re-renders -- snapping the view back
 * and undoing whatever the user had just dragged. Keying on the coordinates
 * themselves means the map is framed when the zones first load (or genuinely
 * change) and left alone after that.
 */
export function FitToMarkers({ points, singleZoom = 13, maxZoom = 13 }) {
  const map = useMap()
  const pointsKey = JSON.stringify(points)
  const lastFitted = useRef(null)

  useEffect(() => {
    if (points.length === 0) return
    if (lastFitted.current === pointsKey) return
    lastFitted.current = pointsKey

    if (points.length === 1) {
      map.setView(points[0], singleZoom)
      return
    }
    map.fitBounds(L.latLngBounds(points), { padding: FIT_PADDING, maxZoom })
    // `points` is intentionally not a dependency; pointsKey stands in for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, pointsKey, singleZoom, maxZoom])

  return null
}
