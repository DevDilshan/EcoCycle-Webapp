import { useState } from 'react'
import { CalendarClock, ListOrdered, Wallet } from 'lucide-react'
import RewardsSubPage from '../../../components/admin/RewardsSubPage'
import RewardHistoryEditor from '../../../components/admin/RewardHistoryEditor'
import EntitySelect from '../../../components/admin/EntitySelect'
import { AcCard, AcKpi } from '../../../components/admin/AcUi'
import { catalogProfilesPending, useAdminCatalog } from '../../../hooks/useAdminCatalog'
import { apiRequest, formatDate } from '../../../lib/api'

export default function RewardHistoryPage() {
  const catalog = useAdminCatalog()
  const [residentId, setResidentId] = useState('')
  const [history, setHistory] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  async function loadHistory(id = residentId) {
    setHistory(await apiRequest(`/rewards/${id}/history?pageSize=20`))
  }

  async function handleLoad(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await loadHistory()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const latest = history?.items?.[0]

  return (
    <RewardsSubPage
      title="Points history"
      description="Look up a resident, then correct or reverse an entry"
      error={error || catalog.error}
      onDismissError={() => setError(null)}
      success={success}
      onDismissSuccess={() => setSuccess(null)}
      kpis={(
        <>
          <AcKpi
            label="Current balance"
            icon={<Wallet size={18} strokeWidth={2} aria-hidden="true" />}
            value={history ? history.currentBalance.toLocaleString() : '—'}
            unit={history ? 'pts' : undefined}
            foot={history ? 'Earned minus redeemed' : 'Pick a resident below'}
          />
          <AcKpi
            label="Entries"
            icon={<ListOrdered size={18} strokeWidth={2} aria-hidden="true" />}
            value={history ? history.totalCount.toLocaleString() : '—'}
            foot="Awards, corrections and redemptions"
          />
          <AcKpi
            label="Latest entry"
            icon={<CalendarClock size={18} strokeWidth={2} aria-hidden="true" />}
            value={latest ? formatDate(latest.createdAt) : '—'}
            foot={latest ? latest.reason : 'No resident selected'}
          />
        </>
      )}
    >
      <AcCard title="Resident" subtitle="Whose points do you want to look at?">
        <form className="ac-form" onSubmit={handleLoad}>
          <div className="ac-field">
            <EntitySelect
              id="history-resident"
              label="Resident"
              value={residentId}
              onChange={setResidentId}
              options={catalog.residentOptions}
              placeholder="Select resident"
              required
            />
          </div>
          <button type="submit" className="ac-btn ac-btn-primary" disabled={busy || catalogProfilesPending(catalog)}>
            Load history
          </button>
        </form>
      </AcCard>

      {history && (
        <AcCard title="Entries" subtitle="Newest first. Edit a wrong entry or reverse it.">
          {history.items.length === 0 ? (
            <p className="ac-empty">This resident has no points entries yet.</p>
          ) : (
            <RewardHistoryEditor
              history={history}
              onChanged={() => loadHistory()}
              onError={setError}
              onSuccess={setSuccess}
            />
          )}
        </AcCard>
      )}
    </RewardsSubPage>
  )
}
