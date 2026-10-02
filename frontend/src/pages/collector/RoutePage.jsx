import { useMemo, useState } from 'react'
import {
  Camera,
  Check,
  ChevronRight,
  Clock,
  MapPin,
  Navigation,
  Package,
  TriangleAlert,
  X,
} from 'lucide-react'
import PageShell from '../../components/admin/AdminPageShell'
import { AcAlert, AcCard, AcChips, AcToast } from '../../components/admin/AcUi'
import { AcCategory, AcCategoryIcon, AcStatusPill, CATEGORY_LABELS } from '../../components/admin/AcPills'
import MarkCompleteDrawer from '../../components/collector/MarkCompleteDrawer'
import ReportMissedDrawer from '../../components/collector/ReportMissedDrawer'
import { useCollectorData } from '../../components/collector/collectorShell'
import { useAuth } from '../../context/AuthContext'
import { formatRequestId } from '../../lib/adminUi'
import { formatShiftDate, formatStopTime } from '../../lib/collectorUi'

export default function CollectorRoutePage() {
  const { role } = useAuth()
  const {
    stops, upcoming, upcomingCount, counts, nextStop,
    loading, error, setError, completeStop, reportMissed,
  } = useCollectorData()

  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState(null)
  const [completing, setCompleting] = useState(null)
  const [reporting, setReporting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(null)

  const filters = [
    { key: '', label: 'All', count: counts.total },
    { key: 'Pending', label: 'Pending', count: counts.pending },
    { key: 'Completed', label: 'Completed', count: counts.completed },
    { key: 'Missed', label: 'Missed', count: counts.missed },
  ]

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return stops.filter((stop) => {
      if (filter && stop.status !== filter) return false
      if (!q) return true
      const text = `${stop.pickup?.description ?? ''} ${stop.pickup?.zoneName ?? ''} ${stop.pickup?.category ?? ''}`
      return text.toLowerCase().includes(q)
    })
  }, [stops, filter, search])

  // The number on a pending dot is its place in the whole round, not in the
  // filtered view, so it still matches the sheet after filtering.
  const positions = useMemo(
    () => new Map(stops.map((stop, index) => [stop.id, index + 1])),
    [stops],
  )

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
              <li className={`c-stop ${tone}${open ? ' is-open' : ''}`.trim()} key={stop.id}>
                <span className="c-stop-dot" aria-hidden="true">
                  {stop.status === 'Completed' ? <Check size={18} strokeWidth={2.6} />
                    : stop.status === 'Missed' ? <X size={18} strokeWidth={2.6} />
                      : positions.get(stop.id)}
                </span>

                <div className="c-stop-card">
                  <div className="c-stop-head">
                    <strong>{pickup?.description || formatRequestId(stop.pickupRequestId)}</strong>
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
                    <span>
                      <Clock size={15} strokeWidth={2} aria-hidden="true" />
                      {formatStopTime(stop.scheduledDate)}
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
                          <span className="ac-sub">Scheduled {formatStopTime(stop.scheduledDate)}</span>
                        </div>
                      </div>

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
          subtitle={`${upcomingCount} stop${upcomingCount === 1 ? '' : 's'} scheduled over the next 7 days`}
        >
          {upcoming.map((day) => (
            <div className="c-upcoming-day" key={day.key}>
              <h3>{formatShiftDate(day.date)}</h3>
              <ul className="ac-list">
                {day.stops.map((stop) => (
                  <li className="ac-row" key={stop.id}>
                    <span className="ac-ic">
                      <AcCategoryIcon category={stop.pickup?.category} size={18} />
                    </span>
                    <span className="ac-grow">
                      <strong>{stop.pickup?.description || formatRequestId(stop.pickupRequestId)}</strong>
                      {/* The address belongs here too: a round cannot be planned
                          from a category and a suburb. */}
                      <span className="ac-sub">
                        {[
                          stop.pickup?.address,
                          stop.pickup?.category ? CATEGORY_LABELS[stop.pickup.category] || stop.pickup.category : null,
                          stop.pickup?.zoneName,
                        ].filter(Boolean).join(' · ') || 'No details available'}
                      </span>
                      {stop.pickup?.isBulkRequest && (
                        <span className="ac-pill ac-s-info">
                          <Package size={13} strokeWidth={2.4} aria-hidden="true" />
                          Bulky
                        </span>
                      )}
                    </span>
                    <span className="ac-time">{formatStopTime(stop.scheduledDate)}</span>
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
