import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Camera,
  Check,
  ChevronRight,
  Clock,
  MapPin,
  Navigation,
  Package,
  Phone,
  TriangleAlert,
  X,
} from 'lucide-react'
import PageShell from '../../components/admin/AdminPageShell'
import { AcAlert, AcCard, AcChips, AcToast } from '../../components/admin/AcUi'
import { AcCategory, AcCategoryIcon, AcStatusPill, CATEGORY_LABELS } from '../../components/admin/AcPills'
import MarkCompleteDrawer from '../../components/collector/MarkCompleteDrawer'
import ReportMissedDrawer from '../../components/collector/ReportMissedDrawer'
import CollectorRouteMap from '../../components/collector/CollectorRouteMap'
import { useCollectorData } from '../../components/collector/collectorShell'
import { useAuth } from '../../context/AuthContext'
import { formatRequestId } from '../../lib/adminUi'
import { formatShiftDate, formatStopDay, formatStopTime, formatStopWhen } from '../../lib/collectorUi'
import { UPCOMING_DAYS } from '../../hooks/useCollectorRoute'

export default function CollectorRoutePage() {
  const { role } = useAuth()
  const location = useLocation()
  const {
    stops, upcoming, upcomingCount, counts, nextStop,
    loading, error, setError, completeStop, reportMissed,
  } = useCollectorData()

  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState(location.state?.stopId ?? null)
  const [completing, setCompleting] = useState(null)
  const [reporting, setReporting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(null)

  // Five, not four. "Pending" used to mean both a stop booked for this morning
  // and one an earlier round never got to, which are the two things a collector
  // most needs to tell apart.
  const filters = [
    { key: '', label: 'All', count: counts.total },
    { key: 'NotCollected', label: 'Not collected', count: counts.notCollected },
    { key: 'ToDo', label: 'To do', count: counts.toDo },
    { key: 'Completed', label: 'Completed', count: counts.completed },
    { key: 'Missed', label: 'Missed', count: counts.missed },
  ]

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return stops.filter((stop) => {
      if (filter === 'NotCollected' && !(stop.status === 'Pending' && stop.carriedOver)) return false
      if (filter === 'ToDo' && !(stop.status === 'Pending' && !stop.carriedOver)) return false
      if ((filter === 'Completed' || filter === 'Missed') && stop.status !== filter) return false
      if (!q) return true
      // The resident and the address are what a collector actually searches by
      // when the office rings about one stop on the round.
      const text = [
        stop.pickup?.description, stop.pickup?.zoneName, stop.pickup?.category,
        stop.pickup?.residentName, stop.pickup?.address, stop.pickup?.residentPhone,
      ].filter(Boolean).join(' ')
      return text.toLowerCase().includes(q)
    })
  }, [stops, filter, search])

  // The number on a pending dot is its place in the whole round, not in the
  // filtered view, so it still matches the sheet after filtering.
  const positions = useMemo(
    () => new Map(stops.map((stop, index) => [stop.id, index + 1])),
    [stops],
  )

  useEffect(() => {
    if (loading || !openId) return undefined
    const frame = requestAnimationFrame(() => document.getElementById(`route-stop-${openId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    return () => cancelAnimationFrame(frame)
  }, [loading, openId])

  async function handleMissed(stop, reason) {
    setBusy(true)
    setError(null)
    try {
      const result = await reportMissed(stop.id, reason)
      setSuccess(
        result?.rescheduled
          ? 'Reported. It has been booked onto a later round.'
          : 'Reported. The office will arrange another visit.',
      )
      setReporting(null)
      setOpenId(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleComplete(stop, notes) {
    setBusy(true)
    setError(null)
    try {
      await completeStop(stop.id, notes)
      setSuccess('Stop marked complete.')
      setCompleting(null)
      setOpenId(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function stopClass(stop) {
    if (stop.status === 'Completed') return 'done'
    if (stop.status === 'Missed') return 'missed'
    if (stop.id === nextStop?.id) return 'current'
    return ''
  }

  return (
    <PageShell
      title="Today's route"
      showDate
      showSearch
      showBell
      hasAlerts={counts.pending > 0}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search today's stops"
      filterBar={(
        <div className="ac-toolbar">
          <AcChips options={filters} value={filter} onChange={setFilter} label="Filter stops by status" />
          <span className="ac-toolbar-meta">{visible.length} of {counts.total} stops</span>
        </div>
      )}
    >
      {role !== 'collector' && (
        <AcAlert message="Route completion requires the collector role." />
      )}
      <AcAlert message={error} onClose={() => setError(null)} />

      {!loading && visible.length > 0 && <CollectorRouteMap stops={visible} positions={positions}
        onOpen={(stop) => {
          setOpenId(stop.id)
          requestAnimationFrame(() => document.getElementById(`route-stop-${stop.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
        }} onComplete={setCompleting} onMissed={setReporting} />}

      {loading ? (
        <p className="ac-empty">Loading today&rsquo;s route…</p>
      ) : counts.total === 0 ? (
        <AcCard><p className="ac-empty">No stops scheduled today.</p></AcCard>
      ) : visible.length === 0 ? (
        <AcCard><p className="ac-empty">No stops match that filter.</p></AcCard>
      ) : (
        <ol className="c-stops">
          {visible.map((stop) => {
            const tone = stopClass(stop)
            const open = openId === stop.id
            const pickup = stop.pickup

            return (
              <li id={`route-stop-${stop.id}`} className={`c-stop ${tone}${open ? ' is-open' : ''}`.trim()} key={stop.id}>
                <span className="c-stop-dot" aria-hidden="true">
                  {stop.status === 'Completed' ? <Check size={18} strokeWidth={2.6} />
                    : stop.status === 'Missed' ? <X size={18} strokeWidth={2.6} />
                      : positions.get(stop.id)}
                </span>

                <div className="c-stop-card">
                  <div className="c-stop-head">
                    <strong>{pickup?.residentName || pickup?.description || formatRequestId(stop.pickupRequestId)}</strong>
                    {tone === 'current' ? (
                      <span className="ac-pill ac-s-info">
                        <Navigation size={13} strokeWidth={2.4} aria-hidden="true" />
                        Next stop
                      </span>
                    ) : (
                      <AcStatusPill status={stop.status} />
                    )}
                  </div>

                  <div className="c-meta">
                    {/* A stop an earlier round never got to. Marked rather than
                        moved to its own section: it keeps its place in the
                        timeline, but it cannot read as booked for this morning.
                        First in the row, because it changes how the rest reads. */}
                    {stop.carriedOver && stop.status === 'Pending' && (
                      <span className="ac-pill ac-s-warn">
                        <TriangleAlert size={13} strokeWidth={2.4} aria-hidden="true" />
                        Not collected {formatStopDay(stop.scheduledDate)}
                      </span>
                    )}
                    <span>
                      <Clock size={15} strokeWidth={2} aria-hidden="true" />
                      {/* The day and the service's hours, not a time of
                          its own. Nothing books a stop for a clock time, so
                          printing one showed the same invented hour against
                          every stop on the round. The completion time below is
                          real. */}
                      {formatStopWhen(stop.scheduledDate)}
                      {stop.completedAt ? ` · done ${formatStopTime(stop.completedAt)}` : null}
                    </span>
                    {pickup?.category && (
                      <AcCategory category={pickup.category} confidence={pickup.confidence} />
                    )}
                    {/* The address is what a driver actually navigates by; the
                        zone only says which round this belongs to. */}
                    {pickup?.address && (
                      <span><MapPin size={15} strokeWidth={2} aria-hidden="true" />{pickup.address}</span>
                    )}
                    {/* A real tel: link. A collector at the kerb taps to call;
                        reading digits off a screen and retyping them is how a
                        stop gets written off instead. */}
                    {pickup?.residentPhone && (
                      <a className="c-stop-tel" href={`tel:${pickup.residentPhone}`}>
                        <Phone size={15} strokeWidth={2} aria-hidden="true" />
                        {pickup.residentPhone}
                      </a>
                    )}
                    {pickup?.zoneName && <span>{pickup.zoneName}</span>}
                    {/* The crew needs to know before they arrive: a bulky
                        collection needs a lift-equipped vehicle, not the bin lorry. */}
                    {pickup?.isBulkRequest && (
                      <span className="ac-pill ac-s-info">
                        <Package size={13} strokeWidth={2.4} aria-hidden="true" />
                        Bulky collection
                      </span>
                    )}
                  </div>

                  {stop.issueNotes && (
                    <div className="c-stop-note" style={{ marginTop: '10px' }}>
                      <TriangleAlert size={15} strokeWidth={2} aria-hidden="true" />
                      <span>{stop.issueNotes}</span>
                    </div>
                  )}

                  {open && (
                    <div className="c-stop-more">
                      <div className="c-ns-grid sm">
                        <div className="c-ns-photo">
                          {pickup?.photoUrl
                            ? <img src={pickup.photoUrl} alt={`Photo submitted with ${pickup.description || 'this pickup'}`} />
                            : <Camera size={18} strokeWidth={2} aria-hidden="true" />}
                        </div>
                        <div>
                          <p className="ac-id">
                            {formatRequestId(stop.id, 'RT')} · {formatRequestId(stop.pickupRequestId)}
                          </p>
                          <span className="ac-sub">Scheduled {formatStopWhen(stop.scheduledDate)}</span>
                        </div>
                      </div>

                      {/* Everything the request carries, so the crew does not
                          have to ring the office to find out who they are
                          visiting or what they are collecting. */}
                      <dl className="ac-kv">
                        {pickup?.residentName && (
                          <>
                            <dt>Resident</dt>
                            <dd>{pickup.residentName}</dd>
                          </>
                        )}
                        {pickup?.residentPhone && (
                          <>
                            <dt>Phone</dt>
                            <dd><a href={`tel:${pickup.residentPhone}`}>{pickup.residentPhone}</a></dd>
                          </>
                        )}
                        {pickup?.address && (
                          <>
                            <dt>Address</dt>
                            <dd>{pickup.address}</dd>
                          </>
                        )}
                        {pickup?.zoneName && (
                          <>
                            <dt>Zone</dt>
                            <dd>{pickup.zoneName}</dd>
                          </>
                        )}
                        {pickup?.category && (
                          <>
                            <dt>Category</dt>
                            <dd>
                              {CATEGORY_LABELS[pickup.category] || pickup.category}
                              {typeof pickup.confidence === 'number'
                                && ` · ${Math.round(pickup.confidence * 100)}% sure`}
                            </dd>
                          </>
                        )}
                        {pickup?.isBulkRequest && (
                          <>
                            <dt>Vehicle</dt>
                            <dd>Bulky collection — needs a lift</dd>
                          </>
                        )}
                        {pickup?.requestedAt && (
                          <>
                            <dt>Requested</dt>
                            {/* How long it has waited, which is the thing a
                                resident asks about when they ring. */}
                            <dd>{formatStopDay(pickup.requestedAt)}</dd>
                          </>
                        )}
                      </dl>

                      {/* The resident's own words in full. The list above cuts
                          them short, and the detail that matters -- "round the
                          back", "two bags not one" -- is usually at the end. */}
                      {pickup?.description && (
                        <p className="c-stop-full">{pickup.description}</p>
                      )}

                      {pickup?.address && (
                        <a
                          className="ac-btn ac-btn-ghost ac-btn-sm c-navigate"
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickup.address)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Navigation size={14} strokeWidth={2} aria-hidden="true" />
                          Navigate to {pickup.address}
                        </a>
                      )}

                      {stop.status === 'Pending' && (
                        <div className="ac-actions">
                          <button
                            type="button"
                            className="ac-btn ac-btn-primary"
                            onClick={() => setCompleting(stop)}
                          >
                            <Check size={16} strokeWidth={2.4} aria-hidden="true" />
                            Mark complete
                          </button>
                          {/* The collector is the one at the kerb, so they are
                              the one who can say it could not be collected. */}
                          <button
                            type="button"
                            className="ac-btn ac-btn-danger"
                            disabled={busy}
                            onClick={() => setReporting(stop)}
                          >
                            <X size={16} strokeWidth={2.4} aria-hidden="true" />
                            Couldn&rsquo;t collect
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    className="ac-link-btn"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : stop.id)}
                  >
                    {open ? 'Hide details' : 'Details'}
                    <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {/* Beyond today. Read-only: a stop can only be completed on its own day,
          so these carry no actions -- they are here to plan around. */}
      {upcoming.length > 0 && (
        <AcCard
          title="Upcoming"
          subtitle={`${upcomingCount} stop${upcomingCount === 1 ? '' : 's'} scheduled over the next ${UPCOMING_DAYS} days`}
        >
          {upcoming.map((day) => (
            <div className="c-upcoming-day" key={day.key}>
              <h3>{formatShiftDate(day.date)}</h3>
              <ul className="ac-list">
                {day.stops.map((stop) => (
                  <li className="ac-row" key={stop.id}>
                    {/* The resident's photo where the category icon was: it says
                        what is actually waiting at the kerb, which the icon only
                        approximates. The icon stays as the fallback. */}
                    <span className="ac-ic c-up-thumb">
                      {stop.pickup?.photoUrl
                        ? <img src={stop.pickup.photoUrl} alt={`Photo for ${stop.pickup?.address || 'this pickup'}`} />
                        : <AcCategoryIcon category={stop.pickup?.category} size={18} />}
                    </span>
                    <span className="ac-grow">
                      {/* Who, then where, then what. A round cannot be planned
                          from a category and a suburb, and the office rings
                          about a resident by name rather than by reference. */}
                      <strong>
                        {stop.pickup?.residentName
                          || stop.pickup?.description
                          || formatRequestId(stop.pickupRequestId)}
                      </strong>
                      <span className="ac-sub">
                        {[
                          stop.pickup?.address,
                          stop.pickup?.category ? CATEGORY_LABELS[stop.pickup.category] || stop.pickup.category : null,
                          stop.pickup?.zoneName,
                        ].filter(Boolean).join(' · ') || 'No details available'}
                      </span>
                      {stop.pickup?.description && stop.pickup?.residentName && (
                        <span className="ac-sub">{stop.pickup.description}</span>
                      )}
                      {stop.pickup?.residentPhone && (
                        <a className="c-stop-tel" href={`tel:${stop.pickup.residentPhone}`}>
                          <Phone size={13} strokeWidth={2.2} aria-hidden="true" />
                          {stop.pickup.residentPhone}
                        </a>
                      )}
                      {stop.pickup?.isBulkRequest && (
                        <span className="ac-pill ac-s-info">
                          <Package size={13} strokeWidth={2.4} aria-hidden="true" />
                          Bulky
                        </span>
                      )}
                    </span>
                    <span className="ac-time">{formatStopDay(stop.scheduledDate)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </AcCard>
      )}

      <ReportMissedDrawer
        stop={reporting}
        busy={busy}
        onClose={() => setReporting(null)}
        onReport={handleMissed}
      />

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
