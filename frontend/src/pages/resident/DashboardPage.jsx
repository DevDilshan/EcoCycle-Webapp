import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageShell from '../../components/PageShell'
import AdminAlert from '../../components/admin/AdminAlert'
import AdminCard from '../../components/admin/AdminCard'
import PickupStatusPill from '../../components/admin/PickupStatusPill'
import { useAuth } from '../../context/AuthContext'
import {
  formatCompactDate,
  formatRequestId,
  inferCategory,
  shortProfileName,
} from '../../lib/adminUi'
import CategoryPill from '../../components/admin/CategoryPill'
import { apiRequest } from '../../lib/api'

function greetingForHour() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function ResidentDashboardPage() {
  const { user, role } = useAuth()
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pickups, setPickups] = useState([])
  const [balance, setBalance] = useState(0)
  const [rank, setRank] = useState(null)
  const [search, setSearch] = useState('')

  const displayName = shortProfileName({
    email: user?.email,
    fullName: user?.user_metadata?.full_name,
  })

  useEffect(() => {
    async function load() {
      if (!user?.id) return
      setLoading(true)
      setError(null)
      try {
        const [pickupData, history, leaders] = await Promise.all([
          apiRequest('/pickuprequests?pageSize=100'),
          apiRequest(`/rewards/${user.id}/history?pageSize=1`),
          apiRequest('/rewards/leaderboard?limit=50'),
        ])

        const items = pickupData.items ?? []
        setPickups(items)
        setBalance(history?.currentBalance ?? 0)
        const myRank = leaders.find((entry) => entry.residentId === user.id)
        setRank(myRank?.rank ?? null)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user?.id])

  const stats = useMemo(() => {
    const pending = pickups.filter((p) => p.status === 'Pending').length
    const inProgress = pickups.filter((p) => ['Classified', 'Approved', 'Scheduled'].includes(p.status)).length
    const completed = pickups.filter((p) => p.status === 'Completed').length
    return {
      total: pickups.length,
      pending,
      inProgress,
      completed,
    }
  }, [pickups])

  const nextPickup = useMemo(() => {
    const upcoming = pickups
      .filter((p) => !['Completed', 'Rejected'].includes(p.status))
      .sort((a, b) => new Date(a.preferredDate) - new Date(b.preferredDate))
    return upcoming[0] ?? null
  }, [pickups])

  const recentActivity = useMemo(() => {
    return [...pickups]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 4)
  }, [pickups])

  if (loading) {
    return (
      <PageShell title={`${greetingForHour()}, ${displayName}`} showDate eyebrow={null}>
        <p className="admin-loading">Loading dashboard…</p>
      </PageShell>
    )
  }

  return (
    <PageShell
      title={`${greetingForHour()}, ${displayName} 👋`}
      showDate
      showSearch
      showBell
      searchValue={search}
      onSearchChange={setSearch}
      eyebrow={null}
      description="Track pickups, points, and recycling activity."
    >
      {role !== 'resident' && (
        <AdminAlert
          type="error"
          message="Your account role is not resident. Some actions may be blocked until app_metadata.role is set to resident in Supabase."
        />
      )}
      <AdminAlert type="error" message={error} onClose={() => setError(null)} />

      <div className="resident-rewards-hero">
        <p className="resident-rewards-label">Reward balance</p>
        <p className="resident-rewards-value">
          {balance.toLocaleString()} <span>pts</span>
        </p>
        <div className="resident-rewards-meta">
          <div>
            <span>🔥 Streak</span>
            <strong>{Math.min(stats.completed, 5)} weeks</strong>
          </div>
          <div>
            <span>Rank</span>
            <strong>{rank ? `#${rank} zone` : '—'}</strong>
          </div>
        </div>
      </div>

      <Link to="/dashboard/pickups" className="resident-cta-card">
        <span className="resident-cta-icon">📷</span>
        <span className="resident-cta-text">
          <strong>Request a pickup</strong>
          <small>Add details — AI classification handles the rest</small>
        </span>
        <span className="resident-cta-arrow">›</span>
      </Link>

      <div className="admin-grid admin-grid-4">
        <div className="stat-card">
          <div className="stat-card-label">Pickup requests</div>
          <p className="stat-card-value">{stats.total}</p>
          <p className="stat-card-hint stat-card-hint-up">{stats.pending} pending</p>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">In progress</div>
          <p className="stat-card-value">{stats.inProgress}</p>
          <p className="stat-card-hint">Classified / scheduled</p>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Completed</div>
          <p className="stat-card-value">{stats.completed}</p>
          <p className="stat-card-hint stat-card-hint-up">Finished pickups</p>
        </div>
        <div className="stat-card stat-card--danger">
          <div className="stat-card-label">Needs action</div>
          <p className="stat-card-value">{stats.pending}</p>
          <p className="stat-card-hint stat-card-hint-danger">Awaiting classification</p>
        </div>
      </div>

      <AdminCard title="Next pickup">
        {!nextPickup ? (
          <p className="admin-empty">No upcoming pickups. Request one to get started.</p>
        ) : (
          <div className="resident-next-pickup">
            <div className="resident-next-date">
              <span>{new Date(nextPickup.preferredDate).toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</span>
              <strong>{new Date(nextPickup.preferredDate).getDate()}</strong>
            </div>
            <div className="resident-next-body">
              <strong>{nextPickup.description?.slice(0, 48) || 'Pickup request'}</strong>
              <small>{formatCompactDate(nextPickup.preferredDate)} · Kerbside window</small>
            </div>
            <PickupStatusPill status={nextPickup.status} />
          </div>
        )}
      </AdminCard>

      <AdminCard title="Recent activity">
        {recentActivity.length === 0 ? (
          <p className="admin-empty">No activity yet.</p>
        ) : (
          <ul className="resident-activity-list">
            {recentActivity.map((item) => {
              // The AI classification when there is one; the keyword guess is only a
              // placeholder for pickups the pipeline has not classified yet.
              const category = item.category || inferCategory(item.description)
              const isPending = ['Pending', 'Approved'].includes(item.status)
              return (
                <li key={item.id} className="resident-activity-item">
                  <span className={`resident-activity-icon${isPending ? ' resident-activity-icon-warn' : ''}`}>
                    {isPending ? '⚠️' : '♻️'}
                  </span>
                  <div className="resident-activity-body">
                    <strong>{item.description?.slice(0, 50) || formatRequestId(item.id)}</strong>
                    <small>
                      {formatRequestId(item.id)} · {formatCompactDate(item.createdAt)}
                    </small>
                  </div>
                  {isPending ? (
                    <span className="design-pill pill-status-pending">Pending</span>
                  ) : (
                    <CategoryPill category={category} />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </AdminCard>
    </PageShell>
  )
}
