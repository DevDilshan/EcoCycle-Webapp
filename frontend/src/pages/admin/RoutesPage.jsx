import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, CircleX, Clock, MapPin, Plus, Route, Users } from 'lucide-react'
import PageShell from '../../components/admin/AdminPageShell'
import { AcAlert, AcCard, AcDrawer, AcKpi, AcToast } from '../../components/admin/AcUi'
import { AcStatusPill } from '../../components/admin/AcPills'
import EntitySelect from '../../components/admin/EntitySelect'
import ZoneCard from '../../components/admin/ZoneCard'
import CollectorSettingsCard from '../../components/admin/CollectorSettingsCard'
import ZoneMap from '../../components/admin/ZoneMap'
import { useAdminCatalog } from '../../hooks/useAdminCatalog'
import { formatRequestId, shortProfileName } from '../../lib/adminUi'
import { formatCompletionStatus } from '../../lib/collector'
import { formatStopTime } from '../../lib/collectorUi'
import { apiRequest } from '../../lib/api'

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

export default function RoutesPage() {
  const catalog = useAdminCatalog(['Approved'])
  const [loadReport, setLoadReport] = useState([])
  const [zoneLoad, setZoneLoad] = useState([])
  // Today's stops across every collector, so an admin can close off one
  // nobody completed. Nothing else in the system can create a Missed row.
  const [dayStops, setDayStops] = useState([])
  // Which day the table is showing. Defaults to today, but a stop routed by the
  // agent is scheduled for tomorrow, so an admin needs to look ahead as well.
  const [dayDate, setDayDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
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
  }

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY_ZONE)
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
  async function handleDeactivateZone(zone) {
    const ok = window.confirm(
      `Deactivate ${zone.name}? It will stop taking new pickups. Existing records keep it.`,
    )
    if (!ok) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await apiRequest(`/zones/${zone.id}`, { method: 'DELETE' })
      setSuccess(`${zone.name} deactivated.`)
      catalog.refresh()
      loadReportData()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleMarkMissed(stop) {
    const ok = window.confirm(
      'Mark this stop as missed? Use this when a collector did not complete it.',
    )
    if (!ok) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await apiRequest(`/routes/${stop.id}/missed`, {
        method: 'PATCH',
        body: JSON.stringify({}),
      })
      setSuccess('Stop marked missed.')
      loadDayStops()
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
    >
      <AcAlert message={error || catalog.error} onClose={() => setError(null)} />

      <div className="ac-grid ac-g4">
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
      </div>

      <div className="ac-grid ac-g-2-1">
        <AcCard title="Zone map" subtitle="Truck badges show pickups waiting. Tap one for details">
          {catalog.loading ? (
            <p className="ac-empty">Loading zones…</p>
          ) : (
            <ZoneMap zones={catalog.zones} loadByZone={zoneStats} collectorName={collectorName} />
          )}
        </AcCard>

        <AcCard title="Manual route assignment" subtitle="Link an approved pickup to a collector">
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
        </AcCard>
      </div>

      <AcCard
        title="Stops by day"
        subtitle="Every scheduled stop on the chosen day, across all collectors"
        action={(
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
        )}
      >
        {dayStops.length === 0 ? (
          <p className="ac-empty">No stops are scheduled for this day.</p>
        ) : (
          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead>
                <tr>
                  <th>Stop</th>
                  <th>Pickup</th>
                  <th>Collector</th>
                  <th>Zone</th>
                  <th>Scheduled</th>
                  <th>Status</th>
                  <th><span className="ac-sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {dayStops.map((stop) => {
                  const status = formatCompletionStatus(stop.completionStatus)
                  const pickup = catalog.pickups.find((p) => p.id === stop.pickupRequestId)
                  return (
                    <tr key={stop.id}>
                      <td className="ac-id">{formatRequestId(stop.id, 'RT')}</td>
                      <td>
                        <strong>{pickup?.description?.slice(0, 40) || formatRequestId(stop.pickupRequestId)}</strong>
                        <span className="ac-sub">{formatRequestId(stop.pickupRequestId)}</span>
                      </td>
                      <td>{shortProfileName(catalog.profileMap.get(stop.collectorId))}</td>
                      <td>{catalog.zoneMap.get(stop.zoneId)?.name || '—'}</td>
                      <td>{formatStopTime(stop.scheduledDate)}</td>
                      <td><AcStatusPill status={status} /></td>
                      <td>
                        {/* Only a stop still pending can be missed: a completed
                            one has a CompletedAt that must not be erased. */}
                        {status === 'Pending' && (
                          <button
                            type="button"
                            className="ac-btn ac-btn-danger ac-btn-sm"
                            disabled={busy}
                            onClick={() => handleMarkMissed(stop)}
                          >
                            <CircleX size={14} strokeWidth={2} aria-hidden="true" />
                            Mark missed
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

      <CollectorSettingsCard onSaved={loadReportData} />

      <div className="ac-section-head">
        <h2>Zones &amp; collectors</h2>
        <button
          type="button"
          className="ac-btn ac-btn-soft"
          onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_ZONE) }}
        >
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          Add zone
        </button>
      </div>

      {loading || catalog.loading ? (
        <p className="ac-empty">Loading zones…</p>
      ) : catalog.zones.length === 0 ? (
        <AcCard><p className="ac-empty">No zones yet. Use “Add zone” to create one.</p></AcCard>
      ) : (
        <div className="ac-grid ac-g3">
          {catalog.zones.map((zone) => (
            <ZoneCard
              key={zone.id}
              zone={zone}
              collectorProfile={zone.assignedCollectorId ? catalog.profileMap.get(zone.assignedCollectorId) : null}
              stats={zoneStats.get(zone.id)}
              isBusiest={Boolean(busiestNamed && busiestNamed.zoneId === zone.id)}
              busy={busy}
              onEdit={() => startEdit(zone)}
              onDeactivate={handleDeactivateZone}
            />
          ))}
        </div>
      )}

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
          {/* Optional: a zone without coordinates is still usable for routing,
              it just cannot be placed on the map. */}
          <div className="ac-two">
            <div className="ac-field">
              <label htmlFor="zone-lat">Latitude</label>
              <input
                id="zone-lat"
                type="number"
                step="0.0001"
                min="-90"
                max="90"
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                placeholder="e.g. 6.9344"
              />
            </div>
            <div className="ac-field">
              <label htmlFor="zone-lng">Longitude</label>
              <input
                id="zone-lng"
                type="number"
                step="0.0001"
                min="-180"
                max="180"
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                placeholder="e.g. 79.8428"
              />
            </div>
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

      <AcToast message={success} onDone={() => setSuccess(null)} />
    </PageShell>
  )
}
