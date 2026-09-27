import { useCallback, useEffect, useMemo, useState } from 'react'
import PageShell from '../../components/PageShell'
import AdminAlert from '../../components/admin/AdminAlert'
import AdminCard from '../../components/admin/AdminCard'
import EntitySelect from '../../components/admin/EntitySelect'
import ZoneCard from '../../components/admin/ZoneCard'
import ZoneMapView from '../../components/admin/ZoneMapView'
import { useAdminCatalog } from '../../hooks/useAdminCatalog'
import { apiRequest } from '../../lib/api'

const EMPTY_ZONE = {
  name: '',
  description: '',
  assignedCollectorId: '',
  latitude: '',
  longitude: '',
  isActive: true,
}

export default function RoutesPage() {
  const catalog = useAdminCatalog(['Approved'])
  const [loadReport, setLoadReport] = useState([])
  const [zoneLoad, setZoneLoad] = useState([])
  const [view, setView] = useState('cards')
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

  // Counts straight from /routes/zone-load, keyed by zone. Nothing is derived or
  // padded here: a zone with no assignments reports zero rather than a guess.
  const zoneStats = useMemo(
    () => new Map(zoneLoad.map((row) => [row.zoneId, row])),
    [zoneLoad],
  )

  function startEdit(zone) {
    setShowForm(true)
    setEditingId(zone.id)
    setForm({
      name: zone.name,
      description: zone.description || '',
      assignedCollectorId: zone.assignedCollectorId || '',
      latitude: zone.latitude ?? '',
      longitude: zone.longitude ?? '',
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
      loadReportData()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const activeCollectors = catalog.collectors.length

  return (
    <PageShell
      title="Zones & collectors"
      eyebrow={null}
      description={`${catalog.zones.length} zones · ${activeCollectors} active collectors`}
      actions={(
        <div className="admin-header-actions-row">
          <div className="admin-view-tabs">
            <button type="button" className={`admin-view-tab${view === 'cards' ? ' active' : ''}`} onClick={() => setView('cards')}>Cards</button>
            <button type="button" className={`admin-view-tab${view === 'map' ? ' active' : ''}`} onClick={() => setView('map')}>Map</button>
          </div>
          <button type="button" className="btn-primary btn-sm" onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_ZONE) }}>
            + New zone
          </button>
        </div>
      )}
    >
      <AdminAlert type="error" message={error || catalog.error} onClose={() => setError(null)} />
      <AdminAlert type="success" message={success} onClose={() => setSuccess(null)} />

      {view === 'map' ? (
        <ZoneMapView zones={catalog.zones} zoneLoad={zoneLoad} loadReport={loadReport} />
      ) : loading || catalog.loading ? (
        <p className="admin-loading">Loading zones…</p>
      ) : catalog.zones.length === 0 ? (
        <p className="admin-empty">No zones yet. Click "+ New zone" to create one.</p>
      ) : (
        <div className="zone-card-grid">
          {catalog.zones.map((zone) => (
            <ZoneCard
              key={zone.id}
              zone={zone}
              collectorProfile={zone.assignedCollectorId ? catalog.profileMap.get(zone.assignedCollectorId) : null}
              stats={zoneStats.get(zone.id)}
              onEdit={() => startEdit(zone)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <AdminCard title={editingId ? 'Edit zone' : 'Create zone'} subtitle="Define zones and assign a collector">
          <form className="admin-form" onSubmit={handleZoneSubmit}>
            <div className="admin-form-row">
              <div>
                <label>Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <EntitySelect
                id="zone-collector"
                label="Assigned collector"
                value={form.assignedCollectorId}
                onChange={(value) => setForm({ ...form, assignedCollectorId: value })}
                options={catalog.collectorOptions}
                placeholder="Select collector (optional)"
              />
            </div>
            <div>
              <label>Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            {/* Optional: a zone without coordinates is still usable for routing,
                it just cannot be placed on the map. */}
            <div className="admin-form-row">
              <div>
                <label>Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  min="-90"
                  max="90"
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  placeholder="e.g. 6.9344"
                />
              </div>
              <div>
                <label>Longitude</label>
                <input
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
            <div className="admin-actions">
              <button type="submit" className="btn-primary btn-sm" disabled={busy}>{editingId ? 'Update zone' : 'Create zone'}</button>
              <button type="button" className="btn-secondary btn-sm" onClick={resetForm}>Cancel</button>
            </div>
          </form>
        </AdminCard>
      )}

      <AdminCard title="Manual route assignment" subtitle="Link an approved pickup to a collector and zone">
        <form className="admin-form" onSubmit={handleCreateRoute}>
          <div className="admin-form-row">
            <EntitySelect id="route-pickup" label="Pickup request" value={routeForm.pickupRequestId} onChange={(value) => setRouteForm({ ...routeForm, pickupRequestId: value })} options={catalog.pickupOptions} placeholder="Select approved pickup" required />
            <EntitySelect id="route-collector" label="Collector" value={routeForm.collectorId} onChange={(value) => setRouteForm({ ...routeForm, collectorId: value })} options={catalog.collectorOptions} placeholder="Select collector" required />
            <EntitySelect id="route-zone" label="Zone" value={routeForm.zoneId} onChange={handleRouteZoneChange} options={catalog.zoneOptions} placeholder="Select zone" required />
            <div>
              <label>Scheduled date</label>
              <input type="datetime-local" value={routeForm.scheduledDate} onChange={(e) => setRouteForm({ ...routeForm, scheduledDate: e.target.value })} required />
            </div>
          </div>
          <button type="submit" className="btn-primary btn-sm" disabled={busy || catalog.loading}>Create assignment</button>
        </form>
      </AdminCard>
    </PageShell>
  )
}
