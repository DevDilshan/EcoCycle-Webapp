import { useMemo, useState } from 'react'
import PageShell from '../../components/PageShell'
import AdminAlert from '../../components/admin/AdminAlert'
import AdminCard from '../../components/admin/AdminCard'
import EntitySelect from '../../components/admin/EntitySelect'
import StatusBadge from '../../components/admin/StatusBadge'
import { useCollectorPickups } from '../../hooks/useCollectorPickups'
import { useAuth } from '../../context/AuthContext'
import { formatCompletionStatus } from '../../lib/collector'
import { apiRequest, formatDate, shortId } from '../../lib/api'

export default function CollectorAssignPage() {
  const { role } = useAuth()
  const { pickupOptions, loading: pickupsLoading, error: pickupsError } = useCollectorPickups(['Approved'])
  const [pickupRequestId, setPickupRequestId] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [busy, setBusy] = useState(false)

  const selectedPickup = useMemo(
    () => pickupOptions.find((opt) => opt.value === pickupRequestId),
    [pickupOptions, pickupRequestId],
  )

  async function handleAssign(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSuccess(null)
    setResult(null)
    try {
      const route = await apiRequest(`/routes/assign/${pickupRequestId}`, {
        method: 'POST',
      })
      setResult(route)
      setSuccess('Pickup assigned to route successfully.')
      setPickupRequestId('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell
      eyebrow="Collector"
      title="Assign pickup"
      description="Add an approved pickup to the next available route."
    >
      {role !== 'collector' && (
        <AdminAlert type="error" message="Assigning pickups requires the collector role." />
      )}
      <AdminAlert type="error" message={error || pickupsError} onClose={() => setError(null)} />
      <AdminAlert type="success" message={success} onClose={() => setSuccess(null)} />

      <AdminCard title="Assign to route" subtitle="POST /api/routes/assign/{pickupRequestId}">
        <form className="admin-form" onSubmit={handleAssign}>
          <EntitySelect
            id="assign-pickup"
            label="Approved pickup"
            value={pickupRequestId}
            onChange={setPickupRequestId}
            options={pickupOptions}
            placeholder="Select approved pickup"
            required
            disabled={pickupsLoading}
          />
          {selectedPickup && (
            <p className="admin-empty" style={{ margin: 0 }}>{selectedPickup.label}</p>
          )}
          <button type="submit" className="btn-primary btn-sm" disabled={busy || role !== 'collector' || pickupsLoading}>
            Assign pickup
          </button>
        </form>

        {result && (
          <div className="admin-panel" style={{ marginTop: '1rem' }}>
            <p><strong>Route ID:</strong> {result.id}</p>
            <p><strong>Pickup:</strong> {shortId(result.pickupRequestId)}</p>
            <p><strong>Collector:</strong> {shortId(result.collectorId)}</p>
            <p><strong>Zone:</strong> {shortId(result.zoneId)}</p>
            <p><strong>Scheduled:</strong> {formatDate(result.scheduledDate)}</p>
            <p>
              <strong>Status:</strong>{' '}
              <StatusBadge status={formatCompletionStatus(result.completionStatus)} />
            </p>
          </div>
        )}
      </AdminCard>
    </PageShell>
  )
}
