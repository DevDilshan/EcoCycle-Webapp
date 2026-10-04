import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, MapPin } from 'lucide-react'
import PageShell from '../../components/admin/AdminPageShell'
import { AcAlert, AcCard } from '../../components/admin/AcUi'
import RouteMap from '../../components/collector/RouteMap'
import { useCollectorData } from '../../components/collector/collectorShell'
import { formatStopDay } from '../../lib/collectorUi'

/**
 * The round on a map, given the whole page.
 *
 * Its own screen rather than a card on the route list: a map is only useful at a
 * size you can read street names off, and in a card it competed for height with
 * the stops a collector actually works from. The Overview keeps a small preview
 * that links here, so the map is still one tap from where a shift starts.
 */
export default function CollectorMapPage() {
  const {
    stops, zonePoints, unmappedCount, nextStop, counts,
    loading, error, setError,
  } = useCollectorData()

  const [search, setSearch] = useState('')

  const unplaced = stops.filter(
    (stop) => stop.zoneLatitude == null || stop.zoneLongitude == null,
  )

  return (
    <PageShell
      title="Route map"
      showDate
      showSearch
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search today&rsquo;s stops"
    >
      <AcAlert message={error} onClose={() => setError(null)} />

      {loading ? (
        <p className="ac-empty">Loading today&rsquo;s route…</p>
      ) : counts.total === 0 ? (
        <AcCard><p className="ac-empty">No stops scheduled today.</p></AcCard>
      ) : (
        <>
          <AcCard
            title="Today&rsquo;s round"
            subtitle={`${counts.total} stop${counts.total === 1 ? '' : 's'} shown around your zone centre — pins are not street addresses`}
            action={(
              <Link className="ac-link-btn" to="/collector/route">
                Open the list <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            )}
          >
            <RouteMap
              stops={stops}
              zones={zonePoints}
              nextStopId={nextStop?.id ?? null}
              tall
            />
          </AcCard>

          {/* Named, not just counted. A collector comparing pins against the
              round needs to know which stops are missing from the map, so they
              can still be driven to from the list. */}
          {unmappedCount > 0 && (
            <AcCard
              title="Not on the map"
              subtitle={`${unmappedCount} stop${unmappedCount === 1 ? '' : 's'} whose zone has no location set`}
            >
              <ul className="ac-list">
                {unplaced.map((stop) => (
                  <li className="ac-row" key={stop.id}>
                    <span className="ac-ic"><MapPin size={18} strokeWidth={2} aria-hidden="true" /></span>
                    <span className="ac-grow">
                      <strong>{stop.pickup?.residentName || stop.pickup?.description || 'Pickup stop'}</strong>
                      <span className="ac-sub">
                        {[stop.pickup?.address, stop.pickup?.zoneName].filter(Boolean).join(' · ')
                          || 'No address recorded'}
                      </span>
                    </span>
                    <span className="ac-time">{formatStopDay(stop.scheduledDate)}</span>
                  </li>
                ))}
              </ul>
            </AcCard>
          )}
        </>
      )}
    </PageShell>
  )
}
