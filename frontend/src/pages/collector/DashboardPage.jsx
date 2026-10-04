import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Camera,
  Check,
  ChevronRight,
  CircleCheckBig,
  CircleX,
  Clock,
  MapPin,
  Navigation,
  Package,
  Phone,
  Route as RouteIcon,
  TriangleAlert,
} from 'lucide-react'
import PageShell from '../../components/admin/AdminPageShell'
import { AcAlert, AcCard, AcToast } from '../../components/admin/AcUi'
import { AcCategory, AcCategoryIcon, CATEGORY_LABELS } from '../../components/admin/AcPills'
import MarkCompleteDrawer from '../../components/collector/MarkCompleteDrawer'
import RouteMap from '../../components/collector/RouteMap'
import { useCollectorData } from '../../components/collector/collectorShell'
import { useAuth } from '../../context/AuthContext'
import { formatRequestId } from '../../lib/adminUi'
import { firstName, formatStopDay, formatStopWhen, greeting, joinNames } from '../../lib/collectorUi'

// r=42 in a 100-box: the ring's circumference, used to drive the arc length.
const RING_R = 42
const RING_C = 2 * Math.PI * RING_R

export default function CollectorDashboardPage() {
  const { user, role } = useAuth()
  const {
    stops, counts, percentDone, nextStop, zones, zoneNames, categories,
    zonePoints, unmappedCount,
    loading, error, setError, completeStop,
  } = useCollectorData()

  const [search, setSearch] = useState('')
  const [completing, setCompleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(null)

  const comingUp = useMemo(() => {
    const pending = stops.filter((stop) => stop.status === 'Pending' && stop.id !== nextStop?.id)
    const q = search.trim().toLowerCase()
    if (!q) return pending
    return pending.filter((stop) => {
      const text = [
        stop.pickup?.description, stop.pickup?.zoneName, stop.pickup?.category,
        stop.pickup?.residentName, stop.pickup?.address, stop.pickup?.residentPhone,
      ].filter(Boolean).join(' ')
      return text.toLowerCase().includes(q)
    })
  }, [stops, nextStop, search])

  async function handleComplete(stop, notes) {
    setBusy(true)
    setError(null)
    try {
      await completeStop(stop.id, notes)
      setSuccess('Stop marked complete.')
      setCompleting(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const zoneSummary = joinNames(zoneNames)

  return (
    <PageShell
      title="Overview"
      showDate
      showSearch
      showBell
      hasAlerts={counts.pending > 0}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search today's stops"
    >
      {role !== 'collector' && (
        <AcAlert message="Your account role is not collector. Set app_metadata.role to collector in Supabase." />
      )}
      <AcAlert message={error} onClose={() => setError(null)} />

      {loading ? (
        <p className="ac-empty">Loading today&rsquo;s route…</p>
      ) : (
        <>
          <section className="c-greet">
            <div>
              <h2>{greeting()}, {firstName(user)}</h2>
              <p>
                {counts.total === 0
                  ? 'Nothing is scheduled for you today.'
                  : counts.pending === 0
                    ? `Route complete — all ${counts.total} stop${counts.total === 1 ? '' : 's'} done.`
                    : `${counts.pending} of ${counts.total} stops left today${zoneSummary ? ` in ${zoneSummary}` : ''}.`}
              </p>
            </div>
            <div className="c-ring" role="img" aria-label={`${percentDone}% of today's stops done`}>
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <circle className="c-trk" cx="50" cy="50" r={RING_R} />
                <circle
                  className="c-val"
                  cx="50"
                  cy="50"
                  r={RING_R}
                  strokeDasharray={RING_C}
                  strokeDashoffset={RING_C * (1 - percentDone / 100)}
                />
              </svg>
              <span aria-hidden="true">{percentDone}%<small>done</small></span>
            </div>
          </section>

          <div className="c-strip">
            <div className="c-mini">
              <span><RouteIcon size={15} strokeWidth={2} aria-hidden="true" /> Today&rsquo;s stops</span>
              <b>{counts.total}</b>
            </div>
            <div className="c-mini warn">
              <span><Clock size={15} strokeWidth={2} aria-hidden="true" /> Pending</span>
              <b>{counts.pending}</b>
            </div>
            <div className="c-mini ok">
              <span><CircleCheckBig size={15} strokeWidth={2} aria-hidden="true" /> Completed</span>
              <b>{counts.completed}</b>
            </div>
            <div className="c-mini bad">
              <span><CircleX size={15} strokeWidth={2} aria-hidden="true" /> Missed</span>
              <b>{counts.missed}</b>
            </div>
          </div>

          <div className="ac-grid ac-g-2-1">
            <AcCard
              title="Next stop"
              subtitle={nextStop ? `Scheduled for ${formatStopWhen(nextStop.scheduledDate)}` : undefined}
            >
              {!nextStop ? (
                <p className="ac-empty">
                  {counts.total === 0 ? 'No stops scheduled today.' : 'Route complete. Nothing left to collect.'}
                </p>
              ) : (
                <div className="c-next">
                  <div className="c-ns-grid">
                    <div className="c-ns-photo">
                      {nextStop.pickup?.photoUrl ? (
                        <img
                          src={nextStop.pickup.photoUrl}
                          alt={`Photo submitted with ${nextStop.pickup.description || 'this pickup'}`}
                        />
                      ) : (
                        <>
                          <Camera size={22} strokeWidth={2} aria-hidden="true" />
                          <span>No photo</span>
                        </>
                      )}
                    </div>
                    <div className="c-ns-info">
                      <p className="ac-id">
                        {formatRequestId(nextStop.id, 'RT')} · {formatRequestId(nextStop.pickupRequestId)}
                      </p>
                      <h3>{nextStop.pickup?.residentName || nextStop.pickup?.description || 'Pickup stop'}</h3>
                      {nextStop.pickup?.residentName && nextStop.pickup?.description && (
                        <p className="ac-sub">{nextStop.pickup.description}</p>
                      )}
                      <div className="c-meta">
                        {nextStop.carriedOver && (
                          <span className="ac-pill ac-s-warn">
                            <TriangleAlert size={13} strokeWidth={2.4} aria-hidden="true" />
                            Not collected {formatStopDay(nextStop.scheduledDate)}
                          </span>
                        )}
                        {nextStop.pickup?.category && (
                          <AcCategory
                            category={nextStop.pickup.category}
                            confidence={nextStop.pickup.confidence}
                          />
                        )}
                        {/* The address, not just the zone: a zone is a whole
                            suburb and cannot be driven to. */}
                        {nextStop.pickup?.address && (
                          <span><MapPin size={15} strokeWidth={2} aria-hidden="true" />{nextStop.pickup.address}</span>
                        )}
                        {nextStop.pickup?.residentPhone && (
                          <a className="c-stop-tel" href={`tel:${nextStop.pickup.residentPhone}`}>
                            <Phone size={15} strokeWidth={2} aria-hidden="true" />
                            {nextStop.pickup.residentPhone}
                          </a>
                        )}
                        {nextStop.pickup?.zoneName && (
                          <span>{nextStop.pickup.zoneName}</span>
                        )}
                        {nextStop.pickup?.isBulkRequest && (
                          <span className="ac-pill ac-s-info">
                            <Package size={13} strokeWidth={2.4} aria-hidden="true" />
                            Bulky collection
                          </span>
                        )}
                        <span><Clock size={15} strokeWidth={2} aria-hidden="true" />{formatStopWhen(nextStop.scheduledDate)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="ac-actions">
                    <button
                      type="button"
                      className="ac-btn ac-btn-primary"
                      onClick={() => setCompleting(nextStop)}
                    >
                      <Check size={16} strokeWidth={2.4} aria-hidden="true" />
                      Mark complete
                    </button>
                    {nextStop.pickup?.address && (
                      <a
                        className="ac-btn ac-btn-ghost"
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nextStop.pickup.address)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Navigation size={16} strokeWidth={2} aria-hidden="true" />
                        Navigate
                      </a>
                    )}
                    <Link to="/collector/route" className="ac-btn ac-btn-ghost">
                      <RouteIcon size={16} strokeWidth={2} aria-hidden="true" />
                      Open today&rsquo;s route
                    </Link>
                  </div>
                </div>
              )}
            </AcCard>

            <div className="ac-grid">
              <AcCard title="By zone" subtitle="Where today&rsquo;s stops are">
                {zones.length === 0 ? (
                  <p className="ac-empty">No zone recorded for today&rsquo;s stops.</p>
                ) : (
                  <ul className="ac-list">
                    {zones.map((zone) => (
                      <li className="ac-row" key={zone.name}>
                        <span className="ac-ic"><MapPin size={18} strokeWidth={2} aria-hidden="true" /></span>
                        <span className="ac-grow">
                          <strong>{zone.name}</strong>
                          <span className="ac-sub">{zone.total} stop{zone.total === 1 ? '' : 's'}</span>
                        </span>
                        {zone.left > 0 && (
                          <span className="ac-pill ac-s-warn">
                            <Clock size={13} strokeWidth={2.4} aria-hidden="true" />
                            {zone.left} left
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </AcCard>

              <AcCard title="What&rsquo;s on board" subtitle="Categories on today&rsquo;s route">
                {categories.length === 0 ? (
                  <p className="ac-empty">No categories to show.</p>
                ) : (
                  <div className="ac-chips">
                    {categories.map(({ key, count }) => (
                      <span className="ac-chip" key={key}>
                        <AcCategoryIcon category={key} />
                        {CATEGORY_LABELS[key] || key}
                        <b>{count}</b>
                      </span>
                    ))}
                  </div>
                )}
              </AcCard>
            </div>
          </div>

          <AcCard
            title="Route map"
            subtitle={`Where today&rsquo;s round takes you${unmappedCount > 0
              ? ` · ${unmappedCount} not shown, no location on their zone`
              : ''}`}
            action={(
              <Link className="ac-link-btn" to="/collector/map">
                Full map <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            )}
          >
            <RouteMap stops={stops} zones={zonePoints} nextStopId={nextStop?.id ?? null} />
          </AcCard>

          <AcCard
            title="Coming up"
            subtitle="The rest of today&rsquo;s pending stops"
            action={(
              <Link className="ac-link-btn" to="/collector/route">
                Full route <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            )}
          >
            {comingUp.length === 0 ? (
              <p className="ac-empty">
                {search.trim() ? 'No stops match that search.' : 'Nothing else is pending today.'}
              </p>
            ) : (
              <ul className="ac-list">
                {comingUp.map((stop) => (
                  <li className="ac-row" key={stop.id}>
                    {/* The photo rather than the category icon: it says what is
                        actually waiting at the kerb. The icon is the fallback. */}
                    <span className="ac-ic c-up-thumb">
                      {stop.pickup?.photoUrl
                        ? <img src={stop.pickup.photoUrl} alt={`Photo for ${stop.pickup?.address || 'this pickup'}`} />
                        : <AcCategoryIcon category={stop.pickup?.category} size={18} />}
                    </span>
                    <span className="ac-grow">
                      <strong>{stop.pickup?.residentName || stop.pickup?.description || formatRequestId(stop.pickupRequestId)}</strong>
                      <span className="ac-sub">
                        {[
                          stop.pickup?.address,
                          stop.pickup?.category ? CATEGORY_LABELS[stop.pickup.category] || stop.pickup.category : null,
                          stop.pickup?.zoneName,
                        ].filter(Boolean).join(' · ') || 'No details available'}
                      </span>
                      {stop.pickup?.residentPhone && (
                        <a className="c-stop-tel" href={`tel:${stop.pickup.residentPhone}`}>
                          <Phone size={13} strokeWidth={2.2} aria-hidden="true" />
                          {stop.pickup.residentPhone}
                        </a>
                      )}
                      {stop.carriedOver && (
                        <span className="ac-pill ac-s-warn">
                          <TriangleAlert size={13} strokeWidth={2.4} aria-hidden="true" />
                          Not collected {formatStopDay(stop.scheduledDate)}
                        </span>
                      )}
                    </span>
                    <span className="ac-time">{formatStopDay(stop.scheduledDate)}</span>
                  </li>
                ))}
              </ul>
            )}
          </AcCard>
        </>
      )}

      <MarkCompleteDrawer
        stop={completing}
        busy={busy}
        onClose={() => setCompleting(null)}
        onComplete={handleComplete}
      />
      <AcToast message={success} onDone={() => setSuccess(null)} />
    </PageShell>
  )
}
