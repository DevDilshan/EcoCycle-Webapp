import { useNavigate } from 'react-router-dom'
import CollectorRouteMap from './CollectorRouteMap'

export default function RouteMap({ stops = [] }) {
  const navigate = useNavigate()
  const positions = new Map(stops.map((stop, index) => [stop.id, index + 1]))
  return <CollectorRouteMap stops={stops} positions={positions}
    onOpen={(stop) => navigate('/collector/route', { state: { stopId: stop.id } })} />
}
