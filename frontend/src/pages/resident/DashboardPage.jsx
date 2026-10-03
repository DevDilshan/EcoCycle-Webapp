import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Camera,
  ChevronRight,
  CircleCheckBig,
  Clock,
  Flame,
  Hourglass,
  Package,
  Recycle,
  Trophy,
  TriangleAlert,
} from 'lucide-react'
import PageShell from '../../components/admin/AdminPageShell'
import { AcAlert, AcCard, AcKpi } from '../../components/admin/AcUi'
import { AcCategory, AcStatusPill } from '../../components/admin/AcPills'
import { useAuth } from '../../context/AuthContext'
import { formatCompactDate, formatRequestId, shortProfileName } from '../../lib/adminUi'
import { apiRequest } from '../../lib/api'
import { residentPickupStatusPillKey } from '../../lib/residentPickupApproval'
import { COLLECTION_WINDOW_LABEL } from '../../lib/collectorUi'

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
    return { total: pickups.length, pending, inProgress, completed }
  }, [pickups])

  const nextPickup = useMemo(() => {
    const upcoming = pickups
      .filter((p) => !['Completed', 'Rejected'].includes(p.status))
      .sort((a, b) => new Date(a.preferredDate) - new Date(b.preferredDate))
    return upcoming[0] ?? null
  }, [pickups])

  // The search box filters the activity feed, which is the only list on this
  // page. It used to accept typing and do nothing at all.
  const recentActivity = useMemo(() => {
    const query = search.trim().toLowerCase()
    return [...pickups]
      .filter((item) => {
        if (!query) return true
        const text = `${item.description ?? ''} ${item.category ?? ''} ${item.zoneName ?? ''}`
        return text.toLowerCase().includes(query) || formatRequestId(item.id).toLowerCase().includes(query)
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, search.trim() ? 10 : 4)
  }, [pickups, search])

  if (loading) {
    return (
      <PageShell title={`${greetingForHour()}, ${displayName}`} showDate>
        <p className="ac-loading">Loading your dashboard…</p>
      </PageShell>
    )
  }

  return (
    <PageShell
      title={`${greetingForHour()}, ${displayName}`}
      showDate
      showSearch
      showBell
      hasAlerts={stats.pending > 0}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search your pickups"
    >
      {role !== 'resident' && (
        <AcAlert message="Your account role is not resident. Some actions may be blocked until app_metadata.role is set to resident in Supabase." />
      )}
      <AcAlert message={error} onClose={() => setError(null)} />

      <section className="r-hero">
        <div>
          <p className="r-hero-label">Reward balance</p>
          <p className="r-hero-value">
            {balance.toLocaleString()}<small>pts</small>
          </p>
        </div>
        <div className="r-hero-meta">
          <div className="r-hero-stat">
            <span>
              <Flame size={13} strokeWidth={2.4} aria-hidden="true" />
              Streak
            </span>
            <strong>{Math.min(stats.completed, 5)} weeks</strong>
          </div>
          <div className="r-hero-stat">
            <span>
              <Trophy size={13} strokeWidth={2.4} aria-hidden="true" />
              Rank
            </span>
            <strong>{rank ? `#${rank}` : '—'}</strong>
          </div>
        </div>
      </section>

      <Link to="/dashboard/pickups" className="r-cta">
        <span className="r-cta-icon">
          <Camera size={20} strokeWidth={2} aria-hidden="true" />
        </span>
        <span className="r-cta-text">
          <strong>Request a pickup</strong>
          <small>Add a photo and the details &mdash; we sort the rest</small>
        </span>
        <ChevronRight className="r-cta-arrow" size={18} strokeWidth={2.4} aria-hidden="true" />
      </Link>

      <div className="ac-grid ac-g4">
        <AcKpi
          label="Pickup requests"
          icon={<Package size={18} strokeWidth={2} aria-hidden="true" />}
          value={stats.total}
          foot="All time"
        />
        <AcKpi
          label="In progress"
          icon={<Clock size={18} strokeWidth={2} aria-hidden="true" />}
          value={stats.inProgress}
          foot="Approved or booked in"
        />
        <AcKpi
          label="Completed"
          icon={<CircleCheckBig size={18} strokeWidth={2} aria-hidden="true" />}
          value={stats.completed}
          foot="Collected and closed"
        />
        <AcKpi
          label="Being sorted"
          icon={<Hourglass size={18} strokeWidth={2} aria-hidden="true" />}
          value={stats.pending}
          foot="Waiting on classification"
          alert={stats.pending > 0}
        />
      </div>

      <AcCard
        title="Next pickup"
        subtitle={`The soonest one still to happen · collections run ${COLLECTION_WINDOW_LABEL}`}
      >
        {!nextPickup ? (
          <p className="ac-empty">No upcoming pickups. Request one to get started.</p>
        ) : (
          <div className="r-next">
            <div className="r-next-date">
              <span>
                {new Date(nextPickup.preferredDate)
                  .toLocaleDateString(undefined, { month: 'short' })
                  .toUpperCase()}
              </span>
              <strong>{new Date(nextPickup.preferredDate).getDate()}</strong>
            </div>
            <div className="r-next-body">
              <strong>{nextPickup.description || formatRequestId(nextPickup.id)}</strong>
              <small>
                {[formatCompactDate(nextPickup.preferredDate), nextPickup.address, nextPickup.zoneName]
                  .filter(Boolean)
                  .join(' · ')}
              </small>
            </div>
            <AcStatusPill status={residentPickupStatusPillKey(nextPickup)} />
          </div>
        )}
      </AcCard>

      <AcCard
        title="Recent activity"
        subtitle={search.trim() ? `Matching “${search.trim()}”` : 'Your last few requests'}
        action={(
          <Link to="/dashboard/pickups" className="ac-link-btn">
            See all
            <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        )}
      >
        {recentActivity.length === 0 ? (
          <p className="ac-empty">
            {search.trim() ? 'No requests match that search.' : 'No activity yet.'}
          </p>
        ) : (
          <ul className="ac-list">
            {recentActivity.map((item) => {
              // Only the real classification is shown. The keyword guess that
              // used to stand in here looked exactly like a decided category,
              // which is misleading now that Bulk draws down a monthly
              // allowance -- a resident could see "Bulk" and reasonably believe
              // a slot had been used when nothing had been decided.
              const needsAttention = ['Pending', 'Approved'].includes(item.status)
              return (
                <li className="ac-row" key={item.id}>
                  <span className="ac-ic">
                    {needsAttention
                      ? <TriangleAlert size={18} strokeWidth={2} aria-hidden="true" />
                      : <Recycle size={18} strokeWidth={2} aria-hidden="true" />}
                  </span>
                  <span className="ac-grow">
                    <strong>{item.description || formatRequestId(item.id)}</strong>
                    <span className="ac-sub">
                      {formatRequestId(item.id)} · {formatCompactDate(item.createdAt)}
                    </span>
                  </span>
                  {item.category
                    ? <AcCategory category={item.category} confidence={item.confidence} />
                    : <AcStatusPill status={residentPickupStatusPillKey(item)} />}
                </li>
              )
            })}
          </ul>
        )}
      </AcCard>
    </PageShell>
  )
}
