import { useCallback, useEffect, useState } from 'react'
import { Eye, EyeOff, Gift, PackageX } from 'lucide-react'
import RewardsSubPage from '../../../components/admin/RewardsSubPage'
import RewardCatalogPanel from '../../../components/admin/RewardCatalogPanel'
import { AcKpi } from '../../../components/admin/AcUi'
import { apiRequest } from '../../../lib/api'

export default function RewardCatalogPage() {
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [stats, setStats] = useState(null)

  const loadStats = useCallback(
    () => apiRequest('/reward-items?pageSize=100')
      .then((page) => setStats({
        total: page.totalCount,
        available: page.items.filter((i) => i.isActive).length,
        hidden: page.items.filter((i) => !i.isActive).length,
        soldOut: page.items.filter((i) => i.stock === 0).length,
      }))
      .catch(() => {}),
    [],
  )

  useEffect(() => { loadStats() }, [loadStats])

  const value = (n) => (stats ? n.toLocaleString() : '—')

  return (
    <RewardsSubPage
      title="Reward items"
      description="What residents can spend their points on"
      error={error}
      onDismissError={() => setError(null)}
      success={success}
      onDismissSuccess={() => setSuccess(null)}
      kpis={(
        <>
          <AcKpi
            label="Items"
            icon={<Gift size={18} strokeWidth={2} aria-hidden="true" />}
            value={value(stats?.total)}
            foot={stats ? `${stats.available} available to residents` : 'Loading…'}
          />
          <AcKpi
            label="Hidden"
            icon={<EyeOff size={18} strokeWidth={2} aria-hidden="true" />}
            value={value(stats?.hidden)}
            foot="Not shown to residents"
          />
          <AcKpi
            label="Sold out"
            icon={stats?.soldOut ? <PackageX size={18} strokeWidth={2} aria-hidden="true" /> : <Eye size={18} strokeWidth={2} aria-hidden="true" />}
            value={value(stats?.soldOut)}
            foot={stats?.soldOut ? 'Restock or hide these' : 'Nothing out of stock'}
            alert={Boolean(stats?.soldOut)}
          />
        </>
      )}
    >
      <RewardCatalogPanel onError={setError} onSuccess={setSuccess} onChanged={loadStats} />
    </RewardsSubPage>
  )
}
