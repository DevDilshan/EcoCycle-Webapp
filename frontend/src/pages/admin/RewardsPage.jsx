import { useEffect, useMemo, useState } from 'react'
import { Award, Trophy, Users } from 'lucide-react'
import PageShell from '../../components/admin/AdminPageShell'
import { AcAlert, AcCard, AcKpi, AcToast } from '../../components/admin/AcUi'
import EntitySelect from '../../components/admin/EntitySelect'
import { useAdminCatalog } from '../../hooks/useAdminCatalog'
import { profileInitials, shortProfileName } from '../../lib/adminUi'
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

  // Only what the leaderboard actually reports. The previous version showed an
  // "avg clean rate" fixed at 91% and a contamination count derived from the
  // number of leaderboard rows; neither came from the API, so both are gone.
  const stats = useMemo(() => {
    const totalPoints = leaderboard.reduce((sum, entry) => sum + (entry.pointsEarned || 0), 0)
    return {
      pointsIssued: totalPoints,
      activeRecyclers: leaderboard.length,
      topScore: leaderboard[0]?.pointsEarned ?? 0,
    }
  }, [leaderboard])

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
      title="Rewards"
      description="Points awarded and the current leaderboard"
      showBell
    >
      <AcAlert message={error || catalog.error} onClose={() => setError(null)} />

      <div className="ac-grid ac-g3">
        <AcKpi
          label="Points issued"
          icon={<Award size={18} strokeWidth={2} aria-hidden="true" />}
          value={stats.pointsIssued.toLocaleString()}
          foot="Across everyone on the leaderboard"
        />
        <AcKpi
          label="Residents earning"
          icon={<Users size={18} strokeWidth={2} aria-hidden="true" />}
          value={stats.activeRecyclers.toLocaleString()}
          foot="With at least one reward"
        />
        <AcKpi
          label="Top score"
          icon={<Trophy size={18} strokeWidth={2} aria-hidden="true" />}
          value={stats.topScore.toLocaleString()}
          foot={leaderboard[0]?.residentName || 'No points recorded yet'}
        />
      </div>

      <AcCard title="Leaderboard" subtitle="Residents ranked by points earned">
        {loading ? (
          <p className="ac-empty">Loading leaderboard…</p>
        ) : leaderboard.length === 0 ? (
          <p className="ac-empty">No points recorded yet.</p>
        ) : (
          <ul className="ac-list">
            {leaderboard.slice(0, 10).map((entry, index) => {
              const profile = catalog.profileMap.get(entry.residentId)
              const name = entry.residentName || shortProfileName(profile)
              const share = stats.topScore ? (entry.pointsEarned / stats.topScore) * 100 : 0
              return (
                <li className="ac-row" key={entry.residentId}>
                  <span className={`ac-rank${index === 0 ? ' is-top' : ''}`}>
                    {entry.rank ?? index + 1}
                  </span>
                  <span className="ac-avatar" aria-hidden="true">{profileInitials(name)}</span>
                  <span className="ac-grow"><strong>{name}</strong></span>
                  <span className="ac-mini-meter">
                    <span className="ac-meter"><i style={{ width: `${share}%` }} /></span>
                  </span>
                  <span className="ac-v">{entry.pointsEarned.toLocaleString()}</span>
                </li>
              )
            })}
          </ul>
        )}
      </AcCard>

      <button
        type="button"
        className="ac-btn ac-btn-ghost"
        onClick={() => setShowTools((v) => !v)}
        aria-expanded={showTools}
      >
        {showTools ? 'Hide admin tools' : 'Show admin tools (award, validate, history)'}
      </button>

      {showTools && (
        <>
          <AcCard title="Validate pickup" subtitle="Run reward rules against a classified pickup">
            <form className="ac-form" onSubmit={handleValidate}>
              <div className="ac-field">
                <EntitySelect
                  id="validate-pickup"
                  label="Classified pickup"
                  value={validatePickupId}
                  onChange={setValidatePickupId}
                  options={classifiedOptions}
                  placeholder="Select classified pickup"
                  required
                />
              </div>
              <button type="submit" className="ac-btn ac-btn-primary" disabled={busy || catalog.loading}>
                Run validation
              </button>
            </form>
            {validationResult && (
              <div className="ac-insight">
                <h4>{validationResult.isValid ? 'Passed' : 'Did not pass'}</h4>
                {validationResult.violatedRules?.length > 0 && (
                  <p>Violated rules: {validationResult.violatedRules.join(', ')}</p>
                )}
              </div>
            )}
          </AcCard>

          <AcCard title="Award reward points" subtitle="Credit a resident for a completed pickup">
            <form className="ac-form" onSubmit={handleAward}>
              <div className="ac-two">
                <div className="ac-field">
                  <EntitySelect
                    id="award-resident"
                    label="Resident"
                    value={awardForm.residentId}
                    onChange={handleResidentChange}
                    options={catalog.residentOptions}
                    placeholder="Select resident"
                    required
                  />
                </div>
                <div className="ac-field">
                  <EntitySelect
                    id="award-pickup"
                    label="Pickup request"
                    value={awardForm.pickupRequestId}
                    onChange={(value) => setAwardForm({ ...awardForm, pickupRequestId: value })}
                    options={residentPickupOptions}
                    placeholder={awardForm.residentId ? 'Select pickup' : 'Select a resident first'}
                    required
                    disabled={!awardForm.residentId}
                  />
                </div>
              </div>
              <div className="ac-two">
                <div className="ac-field">
                  <label htmlFor="award-points">Points</label>
                  <input
                    id="award-points"
                    type="number"
                    min="1"
                    value={awardForm.pointsEarned}
                    onChange={(e) => setAwardForm({ ...awardForm, pointsEarned: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="ac-field">
                  <label htmlFor="award-reason">Reason</label>
                  <input
                    id="award-reason"
                    value={awardForm.reason}
                    onChange={(e) => setAwardForm({ ...awardForm, reason: e.target.value })}
                    required
                  />
                </div>
              </div>
              <button type="submit" className="ac-btn ac-btn-primary" disabled={busy || catalog.loading}>
                Award points
              </button>
            </form>
          </AcCard>

          <AcCard title="Resident reward history">
            <form className="ac-form" onSubmit={handleLoadHistory}>
              <div className="ac-field">
                <EntitySelect
                  id="history-resident"
                  label="Resident"
                  value={historyResidentId}
                  onChange={setHistoryResidentId}
                  options={catalog.residentOptions}
                  placeholder="Select resident"
                  required
                />
              </div>
              <button type="submit" className="ac-btn ac-btn-ghost" disabled={busy || catalog.loading}>
                Load history
              </button>
            </form>
            {history && (
              <div className="ac-table-wrap">
                <table className="ac-table">
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
          </AcCard>
        </>
      )}

      <AcToast message={success} />
    </PageShell>
  )
}
