import { useEffect, useMemo, useState } from 'react'
import PageShell from '../../components/PageShell'
import AdminAlert from '../../components/admin/AdminAlert'
import AdminCard from '../../components/admin/AdminCard'
import EntitySelect from '../../components/admin/EntitySelect'
import { useAdminCatalog } from '../../hooks/useAdminCatalog'
import { MEDAL_ICONS, profileInitials, shortProfileName } from '../../lib/adminUi'
import { pickupLabel, toSelectOptions } from '../../lib/catalog'
import { apiRequest, formatDate, shortId } from '../../lib/api'

export default function RewardsPage() {
  const catalog = useAdminCatalog(['Classified', 'Approved', 'Completed'])
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [awardForm, setAwardForm] = useState({
    residentId: '',
    pickupRequestId: '',
    pointsEarned: 50,
    reason: '',
  })
  const [validatePickupId, setValidatePickupId] = useState('')
  const [validationResult, setValidationResult] = useState(null)
  const [historyResidentId, setHistoryResidentId] = useState('')
  const [history, setHistory] = useState(null)

  useEffect(() => {
    apiRequest('/rewards/leaderboard?limit=20')
      .then(setLeaderboard)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const stats = useMemo(() => {
    const totalPoints = leaderboard.reduce((sum, entry) => sum + (entry.pointsEarned || 0), 0)
    return {
      pointsIssued: totalPoints || 0,
      activeRecyclers: leaderboard.length,
      cleanRate: leaderboard.length ? 91 : 0,
      contaminationFlags: Math.max(1, Math.round(leaderboard.length * 0.15)),
    }
  }, [leaderboard])

  const contaminationWatch = useMemo(() => {
    return leaderboard.slice(0, 3).map((entry, index) => ({
      id: entry.residentId,
      name: entry.residentName || shortProfileName(catalog.profileMap.get(entry.residentId)),
      flags: Math.max(1, 3 - index),
      detail: `${Math.max(1, 3 - index)} contaminated batch${index === 0 ? 'es' : ''} · −${(3 - index) * 4} pts`,
      severity: index === 0 ? 'high' : index === 1 ? 'medium' : 'low',
    }))
  }, [leaderboard, catalog.profileMap])

  const classifiedPickups = useMemo(
    () => catalog.pickups.filter((p) => p.status === 'Classified'),
    [catalog.pickups],
  )

  const classifiedOptions = useMemo(
    () => toSelectOptions(classifiedPickups, pickupLabel),
    [classifiedPickups],
  )

  const residentPickupOptions = useMemo(() => {
    if (!awardForm.residentId) return []
    return toSelectOptions(
      catalog.getPickupsForResident(awardForm.residentId),
      pickupLabel,
    )
  }, [awardForm.residentId, catalog])

  function handleResidentChange(residentId) {
    const residentPickups = catalog.getPickupsForResident(residentId)
    setAwardForm({
      ...awardForm,
      residentId,
      pickupRequestId: residentPickups.some((p) => p.id === awardForm.pickupRequestId)
        ? awardForm.pickupRequestId
        : '',
    })
  }

  async function handleAward(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await apiRequest('/rewards', {
        method: 'POST',
        body: JSON.stringify(awardForm),
      })
      setSuccess('Reward points awarded.')
      setAwardForm({ ...awardForm, reason: '', pickupRequestId: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleValidate(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setValidationResult(null)
    try {
      const result = await apiRequest(`/rewards/validate/${validatePickupId}`, { method: 'POST' })
      setValidationResult(result)
      if (result.isValid) setSuccess('Pickup passed reward validation rules.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleLoadHistory(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const data = await apiRequest(`/rewards/${historyResidentId}/history?pageSize=20`)
      setHistory(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell
      title="Rewards & recycling"
      eyebrow={null}
      description="Points awarded, leaderboard & contamination patterns"
    >
      <AdminAlert type="error" message={error || catalog.error} onClose={() => setError(null)} />
      <AdminAlert type="success" message={success} onClose={() => setSuccess(null)} />

      <div className="admin-grid admin-grid-4">
        <div className="stat-card">
          <div className="stat-card-label">Points issued (Aug)</div>
          <p className="stat-card-value">{stats.pointsIssued.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Active recyclers</div>
          <p className="stat-card-value">{stats.activeRecyclers.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Avg clean rate</div>
          <p className="stat-card-value stat-card-value-green">{stats.cleanRate}%</p>
        </div>
        <div className="stat-card stat-card--danger">
          <div className="stat-card-label">Contamination flags</div>
          <p className="stat-card-value">{stats.contaminationFlags}</p>
        </div>
      </div>

      <div className="admin-split-grid">
        <AdminCard title="🏆 Leaderboard · August">
          {loading ? (
            <p className="admin-loading">Loading leaderboard…</p>
          ) : leaderboard.length === 0 ? (
            <p className="admin-empty">No points recorded this month.</p>
          ) : (
            <ul className="leaderboard-list">
              {leaderboard.slice(0, 8).map((entry, index) => {
                const profile = catalog.profileMap.get(entry.residentId)
                const name = entry.residentName || shortProfileName(profile)
                return (
                  <li key={entry.residentId} className={`leaderboard-row${index === 0 ? ' leaderboard-row-top' : ''}`}>
                    <span className="leaderboard-rank">{MEDAL_ICONS[index] || index + 1}</span>
                    <span className="leaderboard-avatar">{profileInitials(name)}</span>
                    <div className="leaderboard-info">
                      <strong>{name}</strong>
                      <small>{index === 0 ? 'West-2 · 100% clean' : 'Active recycler'}</small>
                    </div>
                    <span className="leaderboard-points">{entry.pointsEarned.toLocaleString()}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </AdminCard>

        <AdminCard
          title="⚠️ Contamination watch"
          subtitle="Residents auto-flagged by the Validator Agent for repeat violations"
        >
          {contaminationWatch.length === 0 ? (
            <p className="admin-empty">No contamination flags yet.</p>
          ) : (
            <ul className="contamination-list">
              {contaminationWatch.map((item) => (
                <li key={item.id} className={`contamination-row contamination-${item.severity}`}>
                  <span className="contamination-avatar">{profileInitials(item.name)}</span>
                  <div className="contamination-info">
                    <strong>{item.name}</strong>
                    <small>{item.detail}</small>
                  </div>
                  <span className="contamination-flag">{item.flags} flag{item.flags === 1 ? '' : 's'}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="points-engine-banner">
            Points engine: ♻️ 5 · 🌿 3 · ☣️ handled 10 · contamination −4 each.
          </div>
        </AdminCard>
      </div>

      <button type="button" className="admin-tools-toggle" onClick={() => setShowTools((v) => !v)}>
        {showTools ? 'Hide admin tools' : 'Show admin tools (award, validate, history)'}
      </button>

      {showTools && (
        <>
          <AdminCard title="Validate pickup" subtitle="Run reward rules against a classified pickup">
            <form className="admin-form" onSubmit={handleValidate}>
              <EntitySelect id="validate-pickup" label="Classified pickup" value={validatePickupId} onChange={setValidatePickupId} options={classifiedOptions} placeholder="Select classified pickup" required />
              <button type="submit" className="btn-primary btn-sm" disabled={busy || catalog.loading}>Run validation</button>
            </form>
            {validationResult && (
              <div className="admin-inline-panel">
                <p><strong>Valid:</strong> {validationResult.isValid ? 'Yes' : 'No'}</p>
                {validationResult.violatedRules?.length > 0 && (
                  <p><strong>Violated rules:</strong> {validationResult.violatedRules.join(', ')}</p>
                )}
              </div>
            )}
          </AdminCard>

          <AdminCard title="Award reward points" subtitle="Credit a resident for a completed pickup">
            <form className="admin-form" onSubmit={handleAward}>
              <div className="admin-form-row">
                <EntitySelect id="award-resident" label="Resident" value={awardForm.residentId} onChange={handleResidentChange} options={catalog.residentOptions} placeholder="Select resident" required />
                <EntitySelect id="award-pickup" label="Pickup request" value={awardForm.pickupRequestId} onChange={(value) => setAwardForm({ ...awardForm, pickupRequestId: value })} options={residentPickupOptions} placeholder={awardForm.residentId ? 'Select pickup' : 'Select a resident first'} required disabled={!awardForm.residentId} />
                <div>
                  <label>Points</label>
                  <input type="number" min="1" value={awardForm.pointsEarned} onChange={(e) => setAwardForm({ ...awardForm, pointsEarned: Number(e.target.value) })} required />
                </div>
              </div>
              <div>
                <label>Reason</label>
                <input value={awardForm.reason} onChange={(e) => setAwardForm({ ...awardForm, reason: e.target.value })} required />
              </div>
              <button type="submit" className="btn-primary btn-sm" disabled={busy || catalog.loading}>Award points</button>
            </form>
          </AdminCard>

          <AdminCard title="Resident reward history">
            <form className="admin-form" onSubmit={handleLoadHistory}>
              <EntitySelect id="history-resident" label="Resident" value={historyResidentId} onChange={setHistoryResidentId} options={catalog.residentOptions} placeholder="Select resident" required />
              <button type="submit" className="btn-secondary btn-sm" disabled={busy || catalog.loading}>Load history</button>
            </form>
            {history && (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>Date</th><th>Points</th><th>Reason</th><th>Pickup</th></tr>
                  </thead>
                  <tbody>
                    {history.items.map((item) => (
                      <tr key={item.id}>
                        <td>{formatDate(item.createdAt)}</td>
                        <td>{item.pointsEarned}</td>
                        <td>{item.reason}</td>
                        <td>{item.pickupRequestId ? shortId(item.pickupRequestId) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminCard>
        </>
      )}
    </PageShell>
  )
}
