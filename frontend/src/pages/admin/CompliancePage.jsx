import { useEffect, useState } from 'react'
import { CircleCheckBig, CircleAlert, MessageSquare, ShieldCheck } from 'lucide-react'
import PageShell from '../../components/admin/AdminPageShell'
import { AcAlert, AcBars, AcCard, AcKpi } from '../../components/admin/AcUi'
import { apiRequest } from '../../lib/api'

// The PickupStatus enum in backend/Models/PickupRequest.cs, in the order a
// request moves through it. Anything not in that enum makes the endpoint return
// 400 rather than an empty count, so this list has to match it exactly.
const PICKUP_STATUSES = ['Pending', 'Classified', 'Approved', 'Scheduled', 'Completed']

export default function CompliancePage() {
  const [stats, setStats] = useState({ complaints: 0, open: 0, inProgress: 0, resolved: 0 })
  const [pickupCounts, setPickupCounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const [total, open, inProgress, resolved, ...pickups] = await Promise.all([
          apiRequest('/complaints?pageSize=1'),
          apiRequest('/complaints?status=Open&pageSize=1'),
          apiRequest('/complaints?status=InProgress&pageSize=1'),
          apiRequest('/complaints?status=Resolved&pageSize=1'),
          ...PICKUP_STATUSES.map((status) =>
            apiRequest(`/pickuprequests?status=${status}&pageSize=1`).catch(() => null)),
        ])

        setStats({
          complaints: total.totalCount,
          open: open.totalCount,
          inProgress: inProgress.totalCount,
          resolved: resolved.totalCount,
        })

        setPickupCounts(
          PICKUP_STATUSES.map((status, index) => ({
            label: status === 'Completed' ? 'Collected' : status,
            value: pickups[index]?.totalCount ?? 0,
          })).filter((row) => row.value > 0),
        )
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const resolutionRate = stats.complaints
    ? Math.round((stats.resolved / stats.complaints) * 100)
    : 0

  const complaintRows = [
    { label: 'Open', value: stats.open },
    { label: 'In review', value: stats.inProgress },
    { label: 'Resolved', value: stats.resolved },
  ].filter((row) => row.value > 0)

  const monthLabel = new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <PageShell
      title="Compliance report"
      description={`${monthLabel} · municipal overview`}
      showBell
    >
      <AcAlert message={error} onClose={() => setError(null)} />

      <div className="ac-grid ac-g4">
        <AcKpi
          label="Complaints logged"
          icon={<MessageSquare size={18} strokeWidth={2} aria-hidden="true" />}
          value={stats.complaints}
          foot="All time"
        />
        <AcKpi
          label="Still open"
          icon={<CircleAlert size={18} strokeWidth={2} aria-hidden="true" />}
          value={stats.open}
          alert={stats.open > 0}
          foot={stats.inProgress ? `${stats.inProgress} more in review` : 'None in review'}
        />
        <AcKpi
          label="Resolved"
          icon={<CircleCheckBig size={18} strokeWidth={2} aria-hidden="true" />}
          value={stats.resolved}
          foot="Closed by an admin"
        />
        <AcKpi
          label="Resolution rate"
          icon={<ShieldCheck size={18} strokeWidth={2} aria-hidden="true" />}
          value={`${resolutionRate}%`}
          foot={(
            <>
              <span className="ac-meter" style={{ flex: 1 }}>
                <i style={{ width: `${resolutionRate}%` }} />
              </span>
            </>
          )}
        />
      </div>

      <div className="ac-grid ac-g-1-1">
        <AcCard title="Complaints by status" subtitle="Counted from the complaints endpoint">
          {loading ? <p className="ac-empty">Loading…</p> : <AcBars rows={complaintRows} />}
        </AcCard>

        <AcCard title="Pickup requests by status" subtitle="Counted from the pickup requests endpoint">
          {loading ? <p className="ac-empty">Loading…</p> : <AcBars rows={pickupCounts} />}
        </AcCard>
      </div>

      <AcCard>
        <p className="ac-note">
          Every figure here is a live count from the API. Violations by type, violations by zone,
          average resolution time and the month-on-month trend are not shown because nothing in the
          API records them: complaints carry no category, no zone and no resolution target.
        </p>
      </AcCard>
    </PageShell>
  )
}
