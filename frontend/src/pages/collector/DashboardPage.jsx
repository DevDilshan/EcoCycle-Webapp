import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageShell from '../../components/PageShell'
import AdminAlert from '../../components/admin/AdminAlert'
import AdminCard from '../../components/admin/AdminCard'
import StatusBadge from '../../components/admin/StatusBadge'
import { useAuth } from '../../context/AuthContext'
import { formatCompletionStatus, isRoutePending } from '../../lib/collector'
import { apiRequest, formatDate, shortId } from '../../lib/api'

export default function CollectorDashboardPage() {
  const { user, role } = useAuth()
  const [routes, setRoutes] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!user?.id) return
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest(`/routes/${user.id}/today`)
        setRoutes(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user?.id])

  const pending = routes.filter((r) => isRoutePending(r.completionStatus)).length
  const completed = routes.filter((r) => formatCompletionStatus(r.completionStatus) === 'Completed').length
  const missed = routes.filter((r) => formatCompletionStatus(r.completionStatus) === 'Missed').length

  return (
    <PageShell
      eyebrow="Collector"
      title="Overview"
      description="Today's assignments and field operations."
    >
      {role !== 'collector' && (
        <AdminAlert
          type="error"
          message="Your account role is not collector. Set app_metadata.role to collector in Supabase."
        />
      )}
      <AdminAlert type="error" message={error} onClose={() => setError(null)} />

      {loading ? (
        <p className="admin-loading">Loading route summary…</p>
      ) : (
        <>
          <div className="admin-grid">
            <div className="stat-card stat-card--blue">
              <div className="stat-card-label">Today's stops</div>
              <p className="stat-card-value">{routes.length}</p>
              <p className="stat-card-hint">Scheduled for today</p>
            </div>
            <div className="stat-card stat-card--amber">
              <div className="stat-card-label">Pending</div>
              <p className="stat-card-value">{pending}</p>
              <p className="stat-card-hint">Still to complete</p>
            </div>
            <div className="stat-card stat-card--green">
              <div className="stat-card-label">Completed</div>
              <p className="stat-card-value">{completed}</p>
              <p className="stat-card-hint">Marked done</p>
            </div>
            <div className="stat-card stat-card--violet">
              <div className="stat-card-label">Missed</div>
              <p className="stat-card-value">{missed}</p>
              <p className="stat-card-hint">Could not complete</p>
            </div>
          </div>

          <div className="admin-link-grid" style={{ marginTop: '1.25rem' }}>
            <Link to="/collector/route" className="btn-primary">Open today's route</Link>
            <Link to="/collector/assign" className="btn-secondary">Assign pickup</Link>
            <Link to="/collector/classify" className="btn-secondary">Classify pickup</Link>
          </div>

          <AdminCard title="Next stops" subtitle="Upcoming assignments for today">
            {routes.length === 0 ? (
              <p className="admin-empty">No route assignments scheduled for today.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Route</th>
                      <th>Pickup</th>
                      <th>Scheduled</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routes.slice(0, 5).map((route) => (
                      <tr key={route.id}>
                        <td>{shortId(route.id)}</td>
                        <td>{shortId(route.pickupRequestId)}</td>
                        <td>{formatDate(route.scheduledDate)}</td>
                        <td>
                          <StatusBadge status={formatCompletionStatus(route.completionStatus)} />
                        </td>
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
