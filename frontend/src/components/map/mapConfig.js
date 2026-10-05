/**
 * Map constants and plain helpers shared by every Leaflet map in the app.
 *
 * Kept apart from leafletShared.jsx because React Fast Refresh only works when a
 * module exports components alone; mixing constants in with them breaks it.
 */

/** Central Colombo, for when no zone has coordinates to centre on. */
export const FALLBACK_CENTRE = [6.9271, 79.8612]

/** Keeps markers clear of the map edge and of the zoom control. */
export const FIT_PADDING = [70, 70]

export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

export const OSM_TILE_URL = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

/** True on a device whose primary input is touch, used to disable dragging. */
export function isTouchDevice() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(hover: none) and (pointer: coarse)').matches ?? false
}
