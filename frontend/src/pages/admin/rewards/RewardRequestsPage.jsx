import { useCallback, useEffect, useState } from 'react'
import { CircleCheckBig, Clock, X } from 'lucide-react'
import RewardsSubPage from '../../../components/admin/RewardsSubPage'
import RedemptionRequestsPanel from '../../../components/admin/RedemptionRequestsPanel'
import { AcKpi } from '../../../components/admin/AcUi'
import { apiRequest } from '../../../lib/api'

export default function RewardRequestsPage() {
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [stats, setStats] = useState(null)

  const loadStats = useCallback(
    () => Promise.all([
      apiRequest('/redemptions?status=Pending&pageSize=100'),
      apiRequest('/redemptions?status=Approved&pageSize=1'),
      apiRequest('/redemptions?status=Rejected&pageSize=1'),
    ])
      .then(([pending, approved, rejected]) => setStats({
        pending: pending.totalCount,
        pendingPoints: pending.items.reduce((sum, r) => sum + r.points, 0),
        approved: approved.totalCount,
        rejected: rejected.totalCount,
      }))
      .catch(() => {}),
    [],
  )

  useEffect(() => { loadStats() }, [loadStats])

  const value = (n) => (stats ? n.toLocaleString() : '—')

  return (
    <RewardsSubPage
      title="Redemptions"
      description="Residents ask to spend points; you decide"
      error={error}
      onDismissError={() => setError(null)}
      success={success}
      onDismissSuccess={() => setSuccess(null)}
      kpis={(
        <>
          <AcKpi
            label="Waiting for review"
            icon={<Clock size={18} strokeWidth={2} aria-hidden="true" />}
            value={value(stats?.pending)}
            foot={stats ? `${stats.pendingPoints.toLocaleString()} points set aside` : 'Loading…'}
            alert={Boolean(stats?.pending)}
          />
          <AcKpi
            label="Approved"
            icon={<CircleCheckBig size={18} strokeWidth={2} aria-hidden="true" />}
            value={value(stats?.approved)}
            foot="Points deducted"
          />
          <AcKpi
            label="Declined"
            icon={<X size={18} strokeWidth={2} aria-hidden="true" />}
            value={value(stats?.rejected)}
            foot="Nothing deducted"
          />
        </>
      )}
    >
      <RedemptionRequestsPanel onError={setError} onSuccess={setSuccess} onChanged={loadStats} />
    </RewardsSubPage>
  )
}
