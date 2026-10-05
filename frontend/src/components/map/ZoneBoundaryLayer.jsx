import { Polygon, Tooltip } from 'react-leaflet'
import { boundaryPolygons } from '../../lib/zoneBoundary'

export default function ZoneBoundaryLayer({ zones = [], selectedId, outside = false, onSelect }) {
  return zones.flatMap(zone => boundaryPolygons(zone).map((rings, i) => <Polygon
    key={`${zone.id ?? 'draft'}-${i}`} positions={rings}
    pathOptions={{ color: outside && zone.id === selectedId ? '#b42318' : '#00563b', weight: zone.id === selectedId ? 3 : 2, fillOpacity: zone.id === selectedId ? .16 : .07 }}
    eventHandlers={onSelect ? { click: (event) => { event.originalEvent?.stopPropagation(); onSelect(zone) } } : {}}
    interactive={!!onSelect}
  ><Tooltip sticky>{zone.name || 'Collection boundary'}</Tooltip></Polygon>))
}
