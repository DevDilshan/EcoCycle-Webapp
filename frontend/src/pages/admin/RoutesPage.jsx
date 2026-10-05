import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, ChevronRight, CircleX, Clock, MapPin, Plus, Route, TriangleAlert, Users } from 'lucide-react'
import PageShell from '../../components/admin/AdminPageShell'
import { AcAlert, AcCard, AcChips, AcDrawer, AcKpi, AcModal, AcToast } from '../../components/admin/AcUi'
import { AcStatusPill } from '../../components/admin/AcPills'
import EntitySelect from '../../components/admin/EntitySelect'
import ZoneCard from '../../components/admin/ZoneCard'
import CollectorSettingsCard from '../../components/admin/CollectorSettingsCard'
import ZoneMap from '../../components/admin/ZoneMap'
import { useAdminCatalog } from '../../hooks/useAdminCatalog'
import { formatRequestId, shortProfileName } from '../../lib/adminUi'
import { formatCompletionStatus } from '../../lib/collector'
import { formatStopDay } from '../../lib/collectorUi'
import { apiRequest } from '../../lib/api'
import { geocodePlace } from '../../lib/geocode'

const EMPTY_ZONE = {
  name: '',
  description: '',
  assignedCollectorId: '',
  latitude: '',
  longitude: '',
  collectionDays: [],
  isActive: true,
}

// Sunday-first, matching System.DayOfWeek on the backend (0 = Sunday).
const WEEKDAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

/** "12 days ago", for a stop that has been waiting. */
function daysWaiting(scheduledDate) {
  const booked = new Date(scheduledDate)
  if (Number.isNaN(booked.getTime())) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  booked.setHours(0, 0, 0, 0)
  const days = Math.round((today - booked) / 86400000)
  if (days <= 0) return ''
  return days === 1 ? '1 day ago' : `${days} days ago`
}

export default function RoutesPage() {
  const catalog = useAdminCatalog(['Approved'])
  const [loadReport, setLoadReport] = useState([])
  const [zoneLoad, setZoneLoad] = useState([])
  // Today's stops across every collector, so an admin can close off one
  // nobody completed. Nothing else in the system can create a Missed row.
  const [dayStops, setDayStops] = useState([])
  const [overdue, setOverdue] = useState([])
  /** The stop a "not collected" report is being written for, or null. */
  /**
   * Which half of the page is on screen: the day's work, or the zones behind it.
   *
   * Eight sections were stacked on one page -- four tiles, a map, a manual
   * assignment form, a stops table, the collector settings and a grid of zone
   * cards. Each one was reasonable; together they were a wall, and the stops
   * table that an admin actually works from sat halfway down it.
   *
   * Split by task rather than by entity. Running today's round and editing the
   * zones behind it are two different jobs, rarely done in the same sitting.
   */
  const [tab, setTab] = useState('routes')

  /** Which list the stops table is showing: the chosen day, or the overdue queue. */
  const [stopsView, setStopsView] = useState('day')
  /**
   * The zone-name lookup: 'idle' | 'searching' | 'found' | 'notfound' | 'error',
   * with the matched place's full name when one was found.
   */
  const [geo, setGeo] = useState({ status: 'idle', label: '' })

  const [showManualAssign, setShowManualAssign] = useState(false)
  const [missing, setMissing] = useState(null)
  const [missedReason, setMissedReason] = useState('')
  // Which day the table is showing. Defaults to today, but a stop routed by the
  // agent is scheduled for tomorrow, so an admin needs to look ahead as well.
  const [dayDate, setDayDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [retiring, setRetiring] = useState(null)
  const [form, setForm] = useState(EMPTY_ZONE)
  const [editingId, setEditingId] = useState(null)
  const [routeForm, setRouteForm] = useState({
    pickupRequestId: '',
    collectorId: '',
    zoneId: '',
    scheduledDate: new Date().toISOString().slice(0, 16),
  })
  const [busy, setBusy] = useState(false)

  const loadReportData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [loads, zoneReport] = await Promise.all([
        apiRequest('/routes/load-report'),
        apiRequest('/routes/zone-load'),
      ])
      setLoadReport(loads)
      setZoneLoad(zoneReport)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadReportData() }, [loadReportData])

  /**
   * Find the zone's location from its name, a moment after typing stops.
   *
   * Debounced, not on every keystroke: Nominatim allows one request a second and
   * asks that it not be hammered, and "Dehiwala" typed letter by letter is nine
   * lookups for one answer. The previous request is aborted when a newer one
   * starts, so a slow reply for "Deh" cannot overwrite the answer for "Dehiwala".
   *
   * Only while the form is open, and only when the name is long enough to mean
   * anything. A failure leaves the coordinates empty rather than stale: saving a
   * zone with no pin is recoverable, saving it with the previous zone's pin is a
   * wrong answer presented as a right one.
   */
  useEffect(() => {
    if (!showForm) return undefined

    const name = form.name.trim()
    const controller = new AbortController()

    // Every path runs inside the timer, including the too-short one. Setting
    // state straight from the effect body causes a second render before the
    // browser paints the first, which React flags -- and the delay costs nothing
    // here, since the name is still being typed.
    const timer = setTimeout(async () => {
      if (name.length < 3) {
        setGeo({ status: 'idle', label: '' })
        return
      }
      setGeo((g) => ({ ...g, status: 'searching' }))
      try {
        const found = await geocodePlace(name, controller.signal)
        if (controller.signal.aborted) return
        if (found) {
          setForm((f) => ({ ...f, latitude: found.latitude, longitude: found.longitude }))
          setGeo({ status: 'found', label: found.label })
        } else {
          setForm((f) => ({ ...f, latitude: '', longitude: '' }))
          setGeo({ status: 'notfound', label: '' })
        }
      } catch (err) {
        // An abort is the next lookup taking over, not a failure to report.
        if (err.name === 'AbortError') return
        setForm((f) => ({ ...f, latitude: '', longitude: '' }))
        setGeo({ status: 'error', label: '' })
      }
    }, 700)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // Deliberately keyed on the name alone: the form object changes on every
    // field, and re-running this for a collection-day toggle would geocode the
    // same name again.
  }, [form.name, showForm])

  // Split rather than sorted: the two groups answer different questions, and a
  // retired zone among the active ones is read as one of them at a glance.
  const activeZones = useMemo(
    () => catalog.zones.filter((z) => z.isActive !== false),
    [catalog.zones],
  )
  const retiredZones = useMemo(
    () => catalog.zones.filter((z) => z.isActive === false),
    [catalog.zones],
  )

  const isOverdueView = stopsView === 'overdue'
  const visibleStops = isOverdueView ? overdue : dayStops

  // Stops that aged off a collector's round. Its own request, because a failure
  // here must not cost the admin the day's table as well.
  const loadOverdue = useCallback(() => {
    apiRequest('/routes/overdue')
      .then((data) => setOverdue(Array.isArray(data) ? data : data?.items ?? []))
      .catch(() => setOverdue([]))
  }, [])

  useEffect(() => { loadOverdue() }, [loadOverdue])

  const loadDayStops = useCallback(() => {
    apiRequest(`/routes/day?date=${dayDate}`)
      .then((data) => setDayStops(Array.isArray(data) ? data : data?.items ?? []))
      .catch(() => setDayStops([]))
  }, [dayDate])

  useEffect(() => { loadDayStops() }, [loadDayStops])

  // Counts straight from /routes/zone-load, keyed by zone. Nothing is derived or
  // padded here: a zone with no assignments reports zero rather than a guess.
  const zoneStats = useMemo(
    () => new Map(zoneLoad.map((row) => [row.zoneId, row])),
    [zoneLoad],
  )

  // Real figures, with no stand-in values: a quiet day should read as a quiet
  // day rather than borrowing numbers from somewhere else.
  const pendingPickups = loadReport.reduce((sum, row) => sum + row.pendingAssignments, 0)
  const dueToday = zoneLoad.reduce((sum, row) => sum + row.dueToday, 0)
  const collectorsWithWork = loadReport.filter((row) => row.pendingAssignments > 0).length
  const totalCollectors = loadReport.length

  const busiest = useMemo(
    () => zoneLoad.reduce(
      (top, row) => (row.pendingAssignments > (top?.pendingAssignments ?? -1) ? row : top),
      null,
    ),
    [zoneLoad],
  )
  const busiestNamed = busiest && busiest.pendingAssignments > 0 ? busiest : null

  const unstaffed = catalog.zones.filter(
    (zone) => zone.isActive !== false && !zone.assignedCollectorId,
  )

  const collectorName = useCallback((zone) => {
    if (!zone.assignedCollectorId) return null
    return shortProfileName(catalog.profileMap.get(zone.assignedCollectorId))
  }, [catalog.profileMap])

  function startEdit(zone) {
    setShowForm(true)
    setEditingId(zone.id)
    setForm({
      name: zone.name,
      description: zone.description || '',
      assignedCollectorId: zone.assignedCollectorId || '',
      latitude: zone.latitude ?? '',
      longitude: zone.longitude ?? '',
      collectionDays: zone.collectionDays ?? [],
      isActive: zone.isActive,
    })
    // A zone already placed keeps its pin until the name changes and the lookup
    // runs again. Reporting "idle" against a zone that has coordinates would
    // read as though it had none.
    setGeo(
      zone.latitude != null && zone.longitude != null
        ? { status: 'found', label: zone.name }
        : { status: 'idle', label: '' },
    )
  }

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY_ZONE)
    setGeo({ status: 'idle', label: '' })
    setShowForm(false)
  }

  function handleRouteZoneChange(zoneId) {
    const zone = catalog.zoneMap.get(zoneId)
    setRouteForm({
      ...routeForm,
      zoneId,
      collectorId: zone?.assignedCollectorId || routeForm.collectorId,
    })
  }

  async function handleZoneSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const body = {
        name: form.name,
        description: form.description || null,
        assignedCollectorId: form.assignedCollectorId || null,
        latitude: form.latitude === '' ? null : Number(form.latitude),
        longitude: form.longitude === '' ? null : Number(form.longitude),
        collectionDays: form.collectionDays,
        isActive: form.isActive,
      }
      if (editingId) {
        await apiRequest(`/zones/${editingId}`, { method: 'PUT', body: JSON.stringify(body) })
        setSuccess('Zone updated.')
      } else {
        await apiRequest('/zones', { method: 'POST', body: JSON.stringify(body) })
        setSuccess('Zone created.')
      }
      resetForm()
      catalog.refresh()
      loadReportData()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // "Deactivate" rather than delete: the endpoint keeps the row and clears the
  // active flag, so the zone stops taking new pickups without breaking the
  // history that points at it.
  //
  // A zone with uncollected pickups still in it cannot just be switched off.
  // Routing only ever offers active zones, so those pickups would become
  // unroutable and sit there with nobody told. The backend refuses in that case
  // and says how many there are; the drawer below asks where they should go.
  async function handleDeactivateZone(zone, moveTo = null) {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const query = moveTo ? `?moveTo=${moveTo}` : ''
      const result = await apiRequest(`/zones/${zone.id}${query}`, { method: 'DELETE' })
      setSuccess(result?.message || `${zone.name} deactivated.`)
      setRetiring(null)
      catalog.refresh()
      loadReportData()
    } catch (err) {
      if (err.status === 409 && !moveTo) {
        // Not an error the admin caused -- it is a question. The dialog is
        // already open, so it changes in place from "are you sure" into "where
        // should these go" rather than being replaced by a second popup.
        setRetiring({ zone, message: err.message })
      } else {
        setError(err.message)
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleMarkMissed(stop, issueNotes) {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await apiRequest(`/routes/${stop.id}/missed`, {
        method: 'PATCH',
        // The reason travels with it: the Notifier agent rewrites this into the
        // message the resident reads, and an empty report cannot be explained to
        // anybody.
        body: JSON.stringify({ issueNotes: issueNotes?.trim() || undefined }),
      })

      // Marking missed also tries to book the pickup again. Saying only "marked
      // missed" hid whether that worked, so a rebooking that failed looked
      // exactly like one that succeeded.
      if (result?.rescheduled) {
        setSuccess('Stop marked missed, and the pickup was booked onto a later round.')
      } else {
        setSuccess('Stop marked missed.')
        setError(
          result?.rescheduleMessage
            ? `It could not be booked again: ${result.rescheduleMessage}`
            : 'It could not be booked again. Place it by hand.',
        )
      }
      setMissing(null)
      setMissedReason('')
      loadDayStops()
      loadOverdue()
      loadReportData()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateRoute(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await apiRequest('/routes', {
        method: 'POST',
        body: JSON.stringify({
          pickupRequestId: routeForm.pickupRequestId,
          collectorId: routeForm.collectorId,
          zoneId: routeForm.zoneId,
          scheduledDate: new Date(routeForm.scheduledDate).toISOString(),
        }),
      })
      setSuccess('Route assignment created.')
      setRouteForm({ ...routeForm, pickupRequestId: '' })
      // The pickup is Scheduled now, so refresh the catalog too or it lingers
      // in the dropdown as though it still needed a collector.
      catalog.refresh()
      loadReportData()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell
      title="Zones & routes"
      description={`${catalog.zones.length} zones · ${catalog.collectors.length} collectors`}
      showBell
      actions={tab === 'zones' ? (
        <button
          type="button"
          className="ac-btn ac-btn-primary ac-btn-sm"
          onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_ZONE) }}
        >
          <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
          Add zone
        </button>
      ) : undefined}
      filterBar={(
        <div className="ac-toolbar">
          <AcChips
            options={[
              { key: 'routes', label: 'Today’s routes', count: dueToday },
              { key: 'zones', label: 'Zones', count: catalog.zones.length },
            ]}
            value={tab}
            onChange={setTab}
            label="Which part of the page to show"
          />
          {overdue.length > 0 && tab === 'routes' && (
            <span className="ac-toolbar-meta">{overdue.length} overdue</span>
          )}
        </div>
      )}
    >
      <AcAlert message={error || catalog.error} onClose={() => setError(null)} />

      {/* Two tiles a tab, not four on both: a number is only worth the width
          when it bears on what is being done on that screen. */}
      <div className="ac-grid ac-g-1-1">
        {tab === 'routes' ? (
          <>
            <AcKpi
              label="Pickups waiting"
          icon={<Clock size={18} strokeWidth={2} aria-hidden="true" />}
          value={pendingPickups}
          foot={`Across ${catalog.zones.filter((z) => z.isActive !== false).length} active zones`}
            />
            <AcKpi
              label="Due today"
              icon={<Calendar size={18} strokeWidth={2} aria-hidden="true" />}
              value={dueToday}
              foot="Scheduled for collection"
            />
          </>
        ) : (
          <>
            <AcKpi
              label="Collectors with work"
          icon={<Users size={18} strokeWidth={2} aria-hidden="true" />}
          value={collectorsWithWork}
          unit={`/ ${totalCollectors}`}
          alert={unstaffed.length > 0}
          foot={
            unstaffed.length > 0
              ? `${unstaffed.map((z) => z.name).slice(0, 2).join(', ')}${unstaffed.length > 2 ? '…' : ''} has no collector`
              : 'Every active zone is staffed'
              }
            />
            <AcKpi
              label="Busiest zone"
              icon={<MapPin size={18} strokeWidth={2} aria-hidden="true" />}
              value={busiestNamed ? <span className="ac-kpi-word">{busiestNamed.zoneName}</span> : '—'}
              foot={busiestNamed ? `${busiestNamed.pendingAssignments} pickups waiting` : 'Nothing waiting'}
            />
          </>
        )}
      </div>

      {tab === 'zones' && (
        <AcCard title="Zone map" subtitle="Truck badges show pickups waiting. Tap one for details">
          {catalog.loading ? (
            <p className="ac-empty">Loading zones…</p>
          ) : (
            <ZoneMap zones={catalog.zones} loadByZone={zoneStats} collectorName={collectorName} />
          )}
        </AcCard>
      )}

      {/* Collapsed, and named as the exception it is. A pickup routes itself when
          it is approved, and the Assign button on the pickups list covers the rest.
          This is for the cases neither can reach: a particular crew, a future
          date, another zone's collector covering, or the agent service being down.
          Open by default it read as the normal way to book a stop, which invites
          bypassing the capacity checks the router applies. */}
      {tab === 'routes' && (
        <AcCard
          title="Assign manually"
          subtitle="For a specific collector or a future date — pickups normally route themselves"
          action={(
            <button
              type="button"
              className="ac-link-btn"
              aria-expanded={showManualAssign}
              onClick={() => setShowManualAssign((open) => !open)}
            >
              {showManualAssign ? 'Hide' : 'Open'}
              <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
            </button>
          )}
        >
          {showManualAssign && (
            <form className="ac-form" onSubmit={handleCreateRoute}>
            <div className="ac-field">
              <EntitySelect
                id="route-pickup"
                label="Pickup request"
                value={routeForm.pickupRequestId}
                onChange={(value) => setRouteForm({ ...routeForm, pickupRequestId: value })}
                options={catalog.pickupOptions}
                placeholder="Select approved pickup"
                required
              />
            </div>
            <div className="ac-two">
              <div className="ac-field">
                <EntitySelect
                  id="route-zone"
                  label="Zone"
                  value={routeForm.zoneId}
                  onChange={handleRouteZoneChange}
                  options={catalog.zoneOptions}
                  placeholder="Select zone"
                  required
                />
              </div>
              <div className="ac-field">
                <EntitySelect
                  id="route-collector"
                  label="Collector"
                  value={routeForm.collectorId}
                  onChange={(value) => setRouteForm({ ...routeForm, collectorId: value })}
                  options={catalog.collectorOptions}
                  placeholder="Select collector"
                  required
                />
              </div>
            </div>
            <div className="ac-field">
              <label htmlFor="route-date">Scheduled date</label>
              <input
                id="route-date"
                type="datetime-local"
                value={routeForm.scheduledDate}
                onChange={(e) => setRouteForm({ ...routeForm, scheduledDate: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="ac-btn ac-btn-primary" disabled={busy || catalog.loading}>
              <Route size={16} strokeWidth={2} aria-hidden="true" />
              Create assignment
            </button>
            </form>
          )}
        </AcCard>
      )}

      {tab === 'routes' && (
      <AcCard
        title={isOverdueView ? 'Overdue stops' : 'Stops by day'}
        subtitle={isOverdueView
          ? 'Pending longer than a week, and no longer on any collector’s round'
          : 'Every scheduled stop on the chosen day, across all collectors'}
        action={(
          /* The date picker belongs to the day view only: the overdue queue is
             not a day, and leaving it there implied the two were filters on the
             same date. */
          !isOverdueView && (
            <div className="ac-day-picker">
              <label htmlFor="day-picker">Showing</label>
              <input
                id="day-picker"
                type="date"
                value={dayDate}
                onChange={(e) => setDayDate(e.target.value || new Date().toISOString().slice(0, 10))}
              />
              <button
                type="button"
                className="ac-btn ac-btn-ghost ac-btn-sm"
                onClick={() => setDayDate(new Date().toISOString().slice(0, 10))}
              >
                Today
              </button>
            </div>
          )
        )}
      >
        {/* One table, two lists. A separate panel a few inches above the first
            invited reading one as the other -- and an admin acting on a stop
            from last month as though it were today's. */}
        <div className="ac-toolbar">
          <AcChips
            options={[
              { key: 'day', label: 'By day', count: dayStops.length },
              { key: 'overdue', label: 'Overdue', count: overdue.length },
            ]}
            value={stopsView}
            onChange={setStopsView}
            label="Which stops to show"
          />
        </div>

        {/* Shown in the day view only, because it is the nudge towards the other
            one. Hidden when the queue is empty: a permanent banner saying
            "0 overdue" stops being read, and this needs noticing when it fills. */}
        {!isOverdueView && overdue.length > 0 && (
          <div className="r-notice is-warn">
            <strong>
              {overdue.length} stop{overdue.length === 1 ? '' : 's'} pending longer than a week
            </strong>
            <p>
              They have aged off their collector&rsquo;s round and need reassigning
              or accounting for.
            </p>
            <button
              type="button"
              className="ac-btn ac-btn-danger ac-btn-sm"
              onClick={() => setStopsView('overdue')}
            >
              <TriangleAlert size={14} strokeWidth={2.2} aria-hidden="true" />
              Review overdue stops
            </button>
          </div>
        )}

        {visibleStops.length === 0 ? (
          <p className="ac-empty">
            {isOverdueView
              ? 'Nothing is overdue. Every pending stop is still on a round.'
              : 'No stops are scheduled for this day.'}
          </p>
        ) : (
          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead>
                <tr>
                  <th>Stop</th>
                  <th>Pickup</th>
                  <th>Resident</th>
                  <th>Collector</th>
                  <th>Zone</th>
                  <th>Scheduled</th>
                  <th>Status</th>
                  <th><span className="ac-sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleStops.map((stop) => {
                  const status = formatCompletionStatus(stop.completionStatus)
                  const pickup = catalog.pickups.find((p) => p.id === stop.pickupRequestId)
                  return (
                    <tr key={stop.id}>
                      <td className="ac-id">{formatRequestId(stop.id, 'RT')}</td>
                      <td>
                        <strong>{stop.description?.slice(0, 40)
                          || pickup?.description?.slice(0, 40)
                          || formatRequestId(stop.pickupRequestId)}</strong>
                        <span className="ac-sub">{formatRequestId(stop.pickupRequestId)}</span>
                      </td>
                      {/* Who the visit is to. The table showed only the
                          collector, so an admin taking a call from a resident
                          had no way to find their stop. Served on the stop
                          itself now, rather than looked up client-side. */}
                      <td>
                        <strong>{stop.residentName || '—'}</strong>
                        {stop.residentPhone && (
                          <span className="ac-sub">
                            <a href={`tel:${stop.residentPhone}`}>{stop.residentPhone}</a>
                          </span>
                        )}
                        {stop.address && <span className="ac-sub">{stop.address}</span>}
                      </td>
                      <td>{shortProfileName(catalog.profileMap.get(stop.collectorId))}</td>
                      <td>{catalog.zoneMap.get(stop.zoneId)?.name || '—'}</td>
                      <td>
                        {formatStopDay(stop.scheduledDate)}
                        {/* How long it has waited. A date alone does not say
                            that, and the wait is what a resident rings about. */}
                        {isOverdueView && (
                          <span className="ac-sub">{daysWaiting(stop.scheduledDate)}</span>
                        )}
                      </td>
                      <td><AcStatusPill status={status} /></td>
                      <td>
                        {/* Only a stop still pending can be missed: a completed
                            one has a CompletedAt that must not be erased. */}
                        {status === 'Pending' && (
                          <button
                            type="button"
                            className="ac-btn ac-btn-danger ac-btn-sm"
                            disabled={busy}
                            onClick={() => { setMissing(stop); setMissedReason('') }}
                          >
                            <CircleX size={14} strokeWidth={2} aria-hidden="true" />
                            Record not collected
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </AcCard>
      )}

      {/* The "Add zone" button has moved to the page header, where every other
          admin screen keeps its primary action, so the heading no longer carries
          one of its own. */}
      {tab === 'zones' && <CollectorSettingsCard onSaved={loadReportData} />}

      {tab === 'zones' && (loading || catalog.loading ? (
        <p className="ac-empty">Loading zones…</p>
      ) : catalog.zones.length === 0 ? (
        <AcCard><p className="ac-empty">No zones yet. Use “Add zone” to create one.</p></AcCard>
      ) : (
        <>
          {/* Active and retired are separated rather than mixed and told apart by
              a badge. A retired zone is not a zone with a different status; it is
              not part of the service, and it is here only because its old rounds
              and complaints still name it. */}
          <AcCard
            title="Zones"
            subtitle={`${activeZones.length} active${retiredZones.length > 0
              ? `, ${retiredZones.length} retired` : ''}`}
          >
            <div className="ac-zone-grid">
              {activeZones.map((zone) => (
                <ZoneCard
                  key={zone.id}
                  zone={zone}
                  collectorProfile={zone.assignedCollectorId ? catalog.profileMap.get(zone.assignedCollectorId) : null}
                  stats={zoneStats.get(zone.id)}
                  isBusiest={Boolean(busiestNamed && busiestNamed.zoneId === zone.id)}
                  busy={busy}
                  onEdit={() => startEdit(zone)}
                  // Opens the dialog rather than calling the endpoint: the
                  // confirmation is the dialog's first state now.
                  onDeactivate={(z) => setRetiring({ zone: z, message: null })}
                />
              ))}
            </div>
          </AcCard>

          {retiredZones.length > 0 && (
            <AcCard
              title="Retired"
              subtitle="No longer taking pickups. Kept because earlier rounds and complaints name them"
            >
              <div className="ac-zone-grid">
                {retiredZones.map((zone) => (
                  <ZoneCard
                    key={zone.id}
                    zone={zone}
                    collectorProfile={zone.assignedCollectorId ? catalog.profileMap.get(zone.assignedCollectorId) : null}
                    stats={zoneStats.get(zone.id)}
                    busy={busy}
                    onEdit={() => startEdit(zone)}
                    onDeactivate={(z) => setRetiring({ zone: z, message: null })}
                  />
                ))}
              </div>
            </AcCard>
          )}
        </>
      ))}

      <AcDrawer
        open={showForm}
        onClose={resetForm}
        title={editingId ? 'Edit zone' : 'Add zone'}
      >
        <form className="ac-form" onSubmit={handleZoneSubmit}>
          <div className="ac-field">
            <label htmlFor="zone-name">Name</label>
            <input
              id="zone-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="ac-field">
            <EntitySelect
              id="zone-collector"
              label="Assigned collector"
              value={form.assignedCollectorId}
              onChange={(value) => setForm({ ...form, assignedCollectorId: value })}
              options={catalog.collectorOptions}
              placeholder="Select collector (optional)"
            />
          </div>
          <div className="ac-field">
            <label htmlFor="zone-desc">Description</label>
            <textarea
              id="zone-desc"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          {/* Where the zone sits, looked up from its name rather than typed.
              A zone without coordinates is still usable for routing; it just
              cannot be placed on the map. */}
          <div className="ac-field">
            <label>Place on the map</label>
            <p className="ac-field-hint">
              {geo.status === 'searching' && 'Looking up the location…'}
              {geo.status === 'found' && `Found ${geo.label}.`}
              {geo.status === 'notfound'
                && 'No matching place found. The zone will be saved without a map pin.'}
              {geo.status === 'error'
                && 'The location lookup is unavailable. The zone will be saved without a map pin.'}
              {geo.status === 'idle'
                && 'Type the zone’s name above and its location is found automatically.'}
            </p>
            {/* The numbers are still shown, read-only: an admin checking why a
                pin sits where it does should not have to open the database. */}
            {form.latitude !== '' && form.longitude !== '' && (
              <p className="ac-id">
                {Number(form.latitude).toFixed(4)}, {Number(form.longitude).toFixed(4)}
              </p>
            )}
          </div>
          <div className="ac-field">
            <label>Collection days</label>
            {/* The days this zone's round actually runs. Leaving them all off
                means "no fixed round", and the router may then pick any day. */}
            <div className="ac-days">
              {WEEKDAYS.map((day) => {
                const on = form.collectionDays.includes(day.value)
                return (
                  <button
                    key={day.value}
                    type="button"
                    className={`ac-day${on ? ' is-on' : ''}`}
                    aria-pressed={on}
                    onClick={() => setForm({
                      ...form,
                      collectionDays: on
                        ? form.collectionDays.filter((d) => d !== day.value)
                        : [...form.collectionDays, day.value].sort((a, b) => a - b),
                    })}
                  >
                    {day.label}
                  </button>
                )
              })}
            </div>
            <p className="ac-hint">
              {form.collectionDays.length === 0
                ? 'No fixed days — pickups can be scheduled on any day.'
                : `Pickups are only scheduled on these ${form.collectionDays.length} day(s).`}
            </p>
          </div>

          <label className="ac-check">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Zone is active
          </label>
          <div className="ac-actions">
            <button type="submit" className="ac-btn ac-btn-primary" disabled={busy}>
              {editingId ? 'Update zone' : 'Create zone'}
            </button>
            <button type="button" className="ac-btn ac-btn-ghost" onClick={resetForm}>Cancel</button>
          </div>
        </form>
      </AcDrawer>

      {/* Keyed on the zone so opening it for a different one starts with no
          destination chosen, rather than carrying over a choice made for the
          zone before it. */}
      <RetireZoneDrawer
        key={retiring?.zone?.id ?? 'none'}
        retiring={retiring}
        zones={catalog.zones}
        busy={busy}
        onClose={() => setRetiring(null)}
        onConfirm={(destinationId) => handleDeactivateZone(retiring.zone, destinationId)}
      />

      {/* A real dialog rather than window.confirm: that could not be styled,
          could not ask why, and is suppressed outright by some browsers -- which
          silently turned a destructive action into a no-op. */}
      <AcModal
        open={missing !== null}
        onClose={() => { if (!busy) { setMissing(null); setMissedReason('') } }}
        title="Record as not collected"
      >
        <form
          className="ac-form"
          onSubmit={(e) => {
            e.preventDefault()
            // Required, as the endpoint now insists: the Notifier agent writes the
            // resident's explanation from it, and a blank one produced a message
            // that said a collection was missed and nothing more.
            if (!missedReason.trim()) {
              setError('Say why it could not be collected. The resident is told this.')
              return
            }
            handleMarkMissed(missing, missedReason)
          }}
        >
          {/* Deliberately worded as recording someone else's report. The admin
              was not at the kerb; the collector reports it normally, and this
              covers the case they never did -- which is the case a resident
              rings up about. */}
          <p className="ac-sub">
            Use this when the collector did not report it themselves, for example
            after a resident got in touch.
          </p>

          {missing && (
            <dl className="ac-kv">
              <dt>Resident</dt>
              <dd>{missing.residentName || formatRequestId(missing.pickupRequestId)}</dd>
              {missing.address && (
                <>
                  <dt>Address</dt>
                  <dd>{missing.address}</dd>
                </>
              )}
              <dt>Booked</dt>
              <dd>{formatStopDay(missing.scheduledDate)}</dd>
            </dl>
          )}

          <div className="ac-field">
            <label htmlFor="missed-reason">Why was it not collected?</label>
            <textarea
              id="missed-reason"
              rows={3}
              value={missedReason}
              onChange={(e) => setMissedReason(e.target.value)}
              placeholder="e.g. Nothing was out when the crew called"
              required
            />
            <p className="ac-field-hint">
              Rewritten into the message the resident sees, so write it for them.
            </p>
          </div>

          {/* Said before they commit, not after: the pickup is rebooked as part
              of this, which is not obvious from the button. */}
          <p className="ac-field-hint">
            The pickup will be booked onto a later round automatically.
          </p>

          <div className="ac-actions">
            <button type="submit" className="ac-btn ac-btn-danger" disabled={busy}>
              {busy ? 'Recording…' : 'Record as not collected'}
            </button>
            <button
              type="button"
              className="ac-btn ac-btn-ghost"
              disabled={busy}
              onClick={() => { setMissing(null); setMissedReason('') }}
            >
              Cancel
            </button>
          </div>
        </form>
      </AcModal>

      <AcToast message={success} onDone={() => setSuccess(null)} />
    </PageShell>
  )
}

/**
 * Confirms retiring a zone, and asks where its open pickups should go if it has
 * any.
 *
 * One dialog with two states rather than two dialogs. It opens on the plain
 * question; if the backend refuses -- which it does whenever uncollected pickups
 * are left, because switching the zone off without moving them would make them
 * permanently unroutable -- the same dialog becomes the form that moves them.
 * Previously the first question was a window.confirm, so an admin answered a
 * browser alert captioned "localhost says" and was then shown a second panel.
 *
 * Residents are not attached to a zone -- they pick one per request -- so their
 * open requests are the only thing there is to move.
 */
function RetireZoneDrawer({ retiring, zones, busy, onClose, onConfirm }) {
  const [destinationId, setDestinationId] = useState('')

  const zoneId = retiring?.zone?.id
  /** The backend has said the zone still holds pickups, and named the count. */
  const needsDestination = Boolean(retiring?.message)

  // Only somewhere the pickups can actually be collected from: the zone being
  // retired and any already-retired zone would leave them just as stuck.
  const choices = useMemo(
    () => zones.filter((zone) => zone.id !== zoneId && zone.isActive !== false),
    [zones, zoneId],
  )

  if (!retiring) return null

  return (
    <AcModal open onClose={onClose} title={`Retire ${retiring.zone.name}?`}>
      {!needsDestination ? (
        <>
          <p className="ac-sub">
            It stops taking new pickups. Existing rounds and complaints keep it, so
            nothing already recorded against {retiring.zone.name} is lost.
          </p>
          <div className="ac-actions">
            <button
              type="button"
              className="ac-btn ac-btn-danger"
              disabled={busy}
              onClick={() => onConfirm(null)}
            >
              <CircleX size={16} strokeWidth={2.4} aria-hidden="true" />
              {busy ? 'Retiring…' : 'Retire the zone'}
            </button>
            <button type="button" className="ac-btn ac-btn-ghost" onClick={onClose} disabled={busy}>
              Keep the zone
            </button>
          </div>
        </>
      ) : (
        <>
      <p className="ac-sub">{retiring.message}</p>

      {choices.length === 0 ? (
        <p className="ac-empty">
          There is no other active zone to move them to. Create or reactivate one first.
        </p>
      ) : (
        <>
          <div className="ac-field">
            <label htmlFor="retire-destination">Move the open requests to</label>
            <select
              id="retire-destination"
              value={destinationId}
              onChange={(event) => setDestinationId(event.target.value)}
            >
              <option value="">Choose a zone…</option>
              {choices.map((zone) => (
                <option key={zone.id} value={zone.id}>{zone.name}</option>
              ))}
            </select>
          </div>

          <p className="ac-foot-note">
            <span>
              Their booked stops are released and each one is routed again in the new
              zone, because the collector and the collection days there are different.
              Anything that cannot be fitted in is reported back for you to place by hand.
            </span>
          </p>

          <div className="ac-actions">
            <button
              type="button"
              className="ac-btn ac-btn-danger"
              disabled={busy || !destinationId}
              onClick={() => onConfirm(destinationId)}
            >
              <CircleX size={16} strokeWidth={2.4} aria-hidden="true" />
              Move and deactivate
            </button>
            <button type="button" className="ac-btn ac-btn-ghost" onClick={onClose} disabled={busy}>
              Keep the zone
            </button>
          </div>
        </>
      )}
        </>
      )}
    </AcModal>
  )
}
