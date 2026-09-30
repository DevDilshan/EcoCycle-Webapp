import { useEffect, useMemo, useState } from 'react'
import { Award, Users, Zap } from 'lucide-react'
import RewardsSubPage from '../../../components/admin/RewardsSubPage'
import EntitySelect from '../../../components/admin/EntitySelect'
import { AcCard, AcKpi } from '../../../components/admin/AcUi'
import { useAdminCatalog } from '../../../hooks/useAdminCatalog'
import { pickupLabel, toSelectOptions } from '../../../lib/catalog'
import { apiRequest } from '../../../lib/api'
import { hasErrors, validateAward } from '../../../lib/rewardValidation'

const EMPTY = { residentId: '', pickupRequestId: '', pointsEarned: 50, reason: '' }

export default function RewardAwardPage() {
  const catalog = useAdminCatalog(['Classified', 'Approved', 'Scheduled', 'Completed'])
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [board, setBoard] = useState([])

  function loadBoard() {
    return apiRequest('/rewards/leaderboard?limit=100').then(setBoard).catch(() => {})
  }

  useEffect(() => { loadBoard() }, [])

  const pickupOptions = useMemo(
    () => (form.residentId ? toSelectOptions(catalog.getPickupsForResident(form.residentId), pickupLabel) : []),
    [form.residentId, catalog],
  )

  function handleResidentChange(residentId) {
    const pickups = catalog.getPickupsForResident(residentId)
    setForm({
      ...form,
      residentId,
      pickupRequestId: pickups.some((p) => p.id === form.pickupRequestId) ? form.pickupRequestId : '',
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const found = validateAward(form)
    setErrors(found)
    if (hasErrors(found)) return

    setBusy(true)
    setError(null)
    try {
      await apiRequest('/rewards', { method: 'POST', body: JSON.stringify({ ...form, pointsEarned: Number(form.pointsEarned), reason: form.reason.trim() }) })
      setSuccess('Bonus points awarded.')
      setForm({ ...form, reason: '', pickupRequestId: '' })
      setErrors({})
      loadBoard()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const issued = board.reduce((sum, e) => sum + (e.pointsEarned || 0), 0)

  return (
    <RewardsSubPage
      title="Give points"
      description="A manual bonus or a correction, on top of the automatic awards"
      error={error || catalog.error}
      onDismissError={() => setError(null)}
      success={success}
      onDismissSuccess={() => setSuccess(null)}
      kpis={(
        <>
          <AcKpi
            label="Points issued"
            icon={<Award size={18} strokeWidth={2} aria-hidden="true" />}
            value={issued.toLocaleString()}
            foot="This month, everyone"
          />
          <AcKpi
            label="Residents earning"
            icon={<Users size={18} strokeWidth={2} aria-hidden="true" />}
            value={board.length.toLocaleString()}
            foot="With points this month"
          />
          <AcKpi
            label="Automatic awards"
            icon={<Zap size={18} strokeWidth={2} aria-hidden="true" />}
            value="On"
            foot="Paid when a collector completes a pickup"
          />
        </>
      )}
    >
      <AcCard
        title="Award points"
        subtitle="Residents already earn points on their own. Use this for goodwill or to make up for a mistake."
      >
        <form className="ac-form" onSubmit={handleSubmit} noValidate>
          <div className="ac-two">
            <div className="ac-field">
              <EntitySelect
                id="award-resident"
                label="Resident"
                value={form.residentId}
                onChange={handleResidentChange}
                options={catalog.residentOptions}
                placeholder="Select resident"
              />
              {errors.residentId && <p className="ac-field-error" role="alert">{errors.residentId}</p>}
            </div>
            <div className="ac-field">
              <EntitySelect
                id="award-pickup"
                label="Pickup request"
                value={form.pickupRequestId}
                onChange={(value) => setForm({ ...form, pickupRequestId: value })}
                options={pickupOptions}
                placeholder={form.residentId ? 'Select pickup' : 'Select a resident first'}
                disabled={!form.residentId}
              />
              {errors.pickupRequestId && <p className="ac-field-error" role="alert">{errors.pickupRequestId}</p>}
            </div>
          </div>
          <div className="ac-two">
            <div className="ac-field">
              <label htmlFor="award-points">Points</label>
              <input
                id="award-points"
                type="number"
                min="1"
                step="1"
                value={form.pointsEarned}
                aria-invalid={Boolean(errors.pointsEarned)}
                onChange={(e) => setForm({ ...form, pointsEarned: e.target.value })}
              />
              {errors.pointsEarned && <p className="ac-field-error" role="alert">{errors.pointsEarned}</p>}
            </div>
            <div className="ac-field">
              <label htmlFor="award-reason">Reason</label>
              <input
                id="award-reason"
                value={form.reason}
                maxLength={500}
                aria-invalid={Boolean(errors.reason)}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
              {errors.reason && <p className="ac-field-error" role="alert">{errors.reason}</p>}
            </div>
          </div>
          <button type="submit" className="ac-btn ac-btn-primary" disabled={busy || catalog.loading}>
            Award points
          </button>
        </form>
      </AcCard>
    </RewardsSubPage>
  )
}
