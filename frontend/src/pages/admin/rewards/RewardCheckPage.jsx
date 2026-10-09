import { useMemo, useState } from 'react'
import { FlaskConical, Package, ScanSearch } from 'lucide-react'
import RewardsSubPage from '../../../components/admin/RewardsSubPage'
import EntitySelect from '../../../components/admin/EntitySelect'
import { AcCard, AcKpi } from '../../../components/admin/AcUi'
import { catalogPickupsPending, useAdminCatalog } from '../../../hooks/useAdminCatalog'
import { pickupLabel, toSelectOptions } from '../../../lib/catalog'
import { apiRequest } from '../../../lib/api'

export default function RewardCheckPage() {
  const catalog = useAdminCatalog()
  const [pickupId, setPickupId] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const classified = useMemo(
    () => catalog.pickups.filter((p) => p.status === 'Classified'),
    [catalog.pickups],
  )
  const options = useMemo(() => toSelectOptions(classified, pickupLabel), [classified])

  async function handleRun(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      setResult(await apiRequest(`/rewards/validate/${pickupId}`, { method: 'POST' }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <RewardsSubPage
      title="Check a pickup"
      description="See whether a classified pickup would break a reward rule"
      error={error || catalog.error}
      onDismissError={() => setError(null)}
      kpis={(
        <>
          <AcKpi
            label="Classified pickups"
            icon={<ScanSearch size={18} strokeWidth={2} aria-hidden="true" />}
            value={catalogPickupsPending(catalog) ? '—' : classified.length.toLocaleString()}
            foot="Available to check"
          />
          <AcKpi
            label="Hazardous waste"
            icon={<FlaskConical size={18} strokeWidth={2} aria-hidden="true" />}
            value="Flagged"
            foot="Always needs an admin"
          />
          <AcKpi
            label="Bulk limit"
            icon={<Package size={18} strokeWidth={2} aria-hidden="true" />}
            value="2"
            unit="per month"
            foot="A third one is flagged"
          />
        </>
      )}
    >
      <AcCard title="Pick a pickup" subtitle="This only reads the rules. Nothing is saved or changed.">
        <form className="ac-form" onSubmit={handleRun}>
          <div className="ac-field">
            <EntitySelect
              id="validate-pickup"
              label="Classified pickup"
              value={pickupId}
              onChange={setPickupId}
              options={options}
              placeholder="Select classified pickup"
              required
            />
          </div>
          <button type="submit" className="ac-btn ac-btn-primary" disabled={busy || catalogPickupsPending(catalog)}>
            Run check
          </button>
        </form>
        {result && (
          <div className="ac-insight">
            <h4>{result.isValid ? 'Passed' : 'Would be flagged'}</h4>
            {result.violatedRules?.length > 0 && <p>Rules broken: {result.violatedRules.join(', ')}</p>}
          </div>
        )}
      </AcCard>
    </RewardsSubPage>
  )
}
