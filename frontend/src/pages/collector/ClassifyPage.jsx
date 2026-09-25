import { useMemo, useState } from 'react'
import PageShell from '../../components/PageShell'
import AdminAlert from '../../components/admin/AdminAlert'
import AdminCard from '../../components/admin/AdminCard'
import EntitySelect from '../../components/admin/EntitySelect'
import StatusBadge from '../../components/admin/StatusBadge'
import { useCollectorPickups } from '../../hooks/useCollectorPickups'
import { useAuth } from '../../context/AuthContext'
import { apiRequest, shortId } from '../../lib/api'

const CATEGORIES = ['Organic', 'Recyclable', 'Hazardous', 'EWaste', 'General', 'Bulk']

export default function CollectorClassifyPage() {
  const { role } = useAuth()
  const { pickupOptions, loading: pickupsLoading, error: pickupsError } = useCollectorPickups(['Pending'])
  const [pickupRequestId, setPickupRequestId] = useState('')
  const [form, setForm] = useState({
    category: 'Recyclable',
    confidence: 0.92,
    reasoning: '',
  })
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [busy, setBusy] = useState(false)

  const selectedPickup = useMemo(
    () => pickupOptions.find((opt) => opt.value === pickupRequestId),
    [pickupOptions, pickupRequestId],
  )

  async function handleClassify(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSuccess(null)
    setResult(null)
    try {
      const data = await apiRequest(`/pickuprequests/${pickupRequestId}/classify-evaluate`, {
        method: 'POST',
        body: JSON.stringify(form),
      })
      setResult(data)
      if (data.flagged) {
        setSuccess(`Pickup flagged for review: ${data.violations?.join('; ') || 'Compliance issue detected.'}`)
      } else {
        setSuccess('Pickup classified and passed compliance checks.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell
      eyebrow="Collector"
      title="Classify pickup"
      description="Run AI classification and compliance evaluation on a pickup."
    >
      {role !== 'collector' && (
        <AdminAlert type="error" message="Classification requires the collector role." />
      )}
      <AdminAlert type="error" message={error || pickupsError} onClose={() => setError(null)} />
      <AdminAlert type="success" message={success} onClose={() => setSuccess(null)} />

      <AdminCard title="Classify & evaluate" subtitle="POST /api/pickuprequests/{id}/classify-evaluate">
        <form className="admin-form" onSubmit={handleClassify}>
          <EntitySelect
            id="classify-pickup"
            label="Pending pickup"
            value={pickupRequestId}
            onChange={setPickupRequestId}
            options={pickupOptions}
            placeholder="Select pending pickup"
            required
            disabled={pickupsLoading}
          />
          {selectedPickup && (
            <p className="admin-empty" style={{ margin: 0 }}>{selectedPickup.label}</p>
          )}
          <div className="admin-form-row">
            <div>
              <label>Category</label>
              <select
                className="admin-select"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Confidence (0–1)</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={form.confidence}
                onChange={(e) => setForm({ ...form, confidence: Number(e.target.value) })}
                required
              />
            </div>
          </div>
          <div>
            <label>Reasoning</label>
            <textarea
              value={form.reasoning}
              onChange={(e) => setForm({ ...form, reasoning: e.target.value })}
              placeholder="Describe why this category was chosen…"
              required
            />
          </div>
          <button type="submit" className="btn-primary btn-sm" disabled={busy || role !== 'collector' || pickupsLoading}>
            Run classification
          </button>
        </form>

        {result && (
          <div className="admin-panel" style={{ marginTop: '1rem' }}>
            <p><strong>Pickup:</strong> {shortId(result.pickupRequestId)}</p>
            <p><strong>Status:</strong> <StatusBadge status={result.pickupStatus} /></p>
            <p><strong>Classification ID:</strong> {shortId(result.classificationId)}</p>
            <p><strong>Flagged:</strong> {result.flagged ? 'Yes' : 'No'}</p>
            {result.violations?.length > 0 && (
              <p><strong>Violations:</strong> {result.violations.join(', ')}</p>
            )}
            {result.approvalRequest && (
              <>
                <p><strong>Approval ID:</strong> {shortId(result.approvalRequest.id)}</p>
                <p><strong>Flag reason:</strong> {result.approvalRequest.flagReason}</p>
                <p>
                  <strong>Approval status:</strong>{' '}
                  <StatusBadge status={result.approvalRequest.status} />
                </p>
              </>
            )}
          </div>
        )}
      </AdminCard>
    </PageShell>
  )
}
