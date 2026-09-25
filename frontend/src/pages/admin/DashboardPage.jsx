import { useEffect, useState } from 'react'
import PageShell from '../../components/PageShell'
import AdminAlert from '../../components/admin/AdminAlert'
import AdminCard from '../../components/admin/AdminCard'
import { loadStoredApprovals } from '../../lib/approvals'
import { formatRequestId } from '../../lib/adminUi'
import { apiRequest, formatDate } from '../../lib/api'

function pipelineHeight(value, max) {
  if (!max) return 44
  return Math.max(44, Math.round((value / max) * 130))
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [recentActivity, setRecentActivity] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const pendingApprovals = loadStoredApprovals().length
        const [
          allPickups,
          pendingPickups,
          completedPickups,
          openComplaints,
          allComplaints,
          recentComplaints,
          storedApprovals,
        ] = await Promise.all([
          apiRequest('/pickuprequests?pageSize=1'),
          apiRequest('/pickuprequests?status=Pending&pageSize=1'),
          apiRequest('/pickuprequests?status=Completed&pageSize=1'),
          apiRequest('/complaints?status=Open&pageSize=1'),
          apiRequest('/complaints?pageSize=1'),
          apiRequest('/complaints?pageSize=4'),
          Promise.resolve(loadStoredApprovals()),
        ])

        const totalRequests = allPickups.totalCount || 0
        const resolvedRate = allComplaints.totalCount
          ? Math.round(((allComplaints.totalCount - openComplaints.totalCount) / allComplaints.totalCount) * 100)
          : 0

        setStats({
          requestsToday: pendingPickups.totalCount + completedPickups.totalCount || totalRequests,
          pendingApprovals,
          collectedToday: completedPickups.totalCount,
          openComplaints: openComplaints.totalCount,
          classified: totalRequests,
          routed: Math.max(0, totalRequests - pendingApprovals),
          validated: completedPickups.totalCount,
          flagged: pendingApprovals,
          resolvedRate,
        })

        const activity = []
        storedApprovals.slice(0, 2).forEach((item) => {
          activity.push({
            id: item.id,
            tone: 'danger',
            text: (
              <>
                <strong>{formatRequestId(item.pickupRequestId)}</strong> flagged by Validator —{' '}
                <span className="admin-activity-accent-danger">{item.flagReason}</span>
              </>
            ),
            time: 'Recently',
          })
        })
        ;(recentComplaints.items || []).slice(0, 4 - activity.length).forEach((item) => {
          activity.push({
            id: item.id,
            tone: item.status === 'Open' ? 'warning' : 'success',
            text: (
              <>
                New complaint <strong>{formatRequestId(item.id, 'CMP')}</strong> · {item.description?.slice(0, 40)}
              </>
            ),
            time: formatDate(item.createdAt),
          })
        })
        setRecentActivity(activity)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const pipelineMax = Math.max(
    stats?.classified ?? 0,
    stats?.routed ?? 0,
    stats?.validated ?? 0,
    stats?.flagged ?? 0,
    1,
  )

  if (loading) {
    return (
      <PageShell title="Overview" showDate showSearch showBell eyebrow={null}>
        <p className="admin-loading">Loading dashboard</p>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Overview"
      showDate
      showSearch
      showBell
      searchValue={search}
      onSearchChange={setSearch}
      eyebrow={null}
    >
      <AdminAlert type="error" message={error} onClose={() => setError(null)} />

      <div className="admin-grid admin-grid-4">
        <div className="stat-card">
          <div className="stat-card-label">Requests today</div>
          <p className="stat-card-value">{stats?.requestsToday ?? 0}</p>
          <p className="stat-card-hint stat-card-hint-up">▲ Active submissions</p>
        </div>
        <div className="stat-card stat-card--danger">
          <div className="stat-card-label">Pending approval</div>
          <p className="stat-card-value">{stats?.pendingApprovals ?? 0}</p>
          <p className="stat-card-hint stat-card-hint-danger">Needs your review</p>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Collected today</div>
          <p className="stat-card-value">{stats?.collectedToday ?? 0}</p>
          <p className="stat-card-hint">of {stats?.requestsToday ?? 0} scheduled</p>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Open complaints</div>
          <p className="stat-card-value">{stats?.openComplaints ?? 0}</p>
          <p className="stat-card-hint stat-card-hint-up">{stats?.resolvedRate ?? 0}% resolution rate</p>
        </div>
      </div>

      <div className="admin-split-grid">
        <AdminCard title="Agent pipeline · today" subtitle="Requests flowing through the 4-agent workflow">
          <div className="admin-pipeline">
            <div className="admin-pipeline-step">
              <div
                className="admin-pipeline-bar admin-pipeline-bar-1"
                style={{ height: pipelineHeight(stats?.classified ?? 0, pipelineMax) }}
              >
                {stats?.classified ?? 0}
              </div>
              <span>Classified</span>
            </div>
            <span className="admin-pipeline-arrow" aria-hidden>→</span>
            <div className="admin-pipeline-step">
              <div
                className="admin-pipeline-bar admin-pipeline-bar-2"
                style={{ height: pipelineHeight(stats?.routed ?? 0, pipelineMax) }}
              >
                {stats?.routed ?? 0}
              </div>
              <span>Routed</span>
            </div>
            <span className="admin-pipeline-arrow" aria-hidden>→</span>
            <div className="admin-pipeline-step">
              <div
                className="admin-pipeline-bar admin-pipeline-bar-3"
                style={{ height: pipelineHeight(stats?.validated ?? 0, pipelineMax) }}
              >
                {stats?.validated ?? 0}
              </div>
              <span>Validated</span>
            </div>
            <span className="admin-pipeline-arrow" aria-hidden>→</span>
            <div className="admin-pipeline-step">
              <div
                className="admin-pipeline-bar admin-pipeline-bar-flagged"
                style={{ height: pipelineHeight(stats?.flagged ?? 0, pipelineMax) }}
              >
                {stats?.flagged ?? 0}
              </div>
              <span className="admin-pipeline-flagged-label">Flagged</span>
            </div>
          </div>
        </AdminCard>

        <AdminCard title="Recent activity">
          {recentActivity.length === 0 ? (
            <p className="admin-empty">No recent activity yet.</p>
          ) : (
            <ul className="admin-activity-list">
              {recentActivity.map((item) => (
                <li key={item.id} className="admin-activity-item">
                  <span className={`admin-activity-dot admin-activity-dot-${item.tone}`} />
                  <div>
                    <p className="admin-activity-text">{item.text}</p>
                    <p className="admin-activity-time">{item.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </PageShell>
  )
}
