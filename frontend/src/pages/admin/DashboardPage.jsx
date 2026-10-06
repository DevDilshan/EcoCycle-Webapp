import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronRight,
  Flag,
  Inbox,
  MessageSquare,
  Route,
  ScanSearch,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import PageShell from '../../components/admin/AdminPageShell'
import ZoneMap from '../../components/admin/ZoneMap'
import { AcAlert, AcBars, AcCard, AcKpi } from '../../components/admin/AcUi'
import { AcCategoryIcon } from '../../components/admin/AcPills'
import { useAdminCatalog } from '../../hooks/useAdminCatalog'
import { formatRequestId, shortProfileName } from '../../lib/adminUi'
import { notifyApprovalsUpdated } from '../../lib/approvalEvents'
import { apiRequest, formatDate } from '../../lib/api'
import { pagedTotalCount } from '../../lib/paging'

const CATEGORY_ORDER = ['Recyclable', 'Organic', 'EWaste', 'Hazardous', 'Bulk', 'General']
const CATEGORY_LABELS = { EWaste: 'E-waste' }

export default function DashboardPage() {
  const catalog = useAdminCatalog()
  const [stats, setStats] = useState(null)
  const [recentActivity, setRecentActivity] = useState([])
  const [flagged, setFlagged] = useState([])
  const [zoneLoad, setZoneLoad] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    const request = (path) => apiRequest(path, { signal: controller.signal })
    async function load() {
      try {
        const [
          allPickups,
          pendingPickups,
          completedPickups,
          openComplaints,
          allComplaints,
          recentComplaints,
          approvalQueue,
        ] = await Promise.all([
          request('/pickuprequests?pageSize=1'),
          request('/pickuprequests?status=Pending&pageSize=1'),
          request('/pickuprequests?status=Completed&pageSize=1'),
          request('/complaints?status=Open&pageSize=1'),
          request('/complaints?pageSize=1'),
          request('/complaints?pageSize=4'),
          // The real queue, not this browser's localStorage copy: an approval
          // raised on another machine has to count here too.
          request('/approvals?status=Pending&pageSize=50'),
        ])
        if (cancelled) return

        const flaggedItems = approvalQueue.items ?? []
        const pendingApprovals = pagedTotalCount(approvalQueue) || flaggedItems.length
        notifyApprovalsUpdated(pendingApprovals)

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

        setFlagged(flaggedItems.slice(0, 4))

        const activity = []
        flaggedItems.slice(0, 2).forEach((item) => {
          activity.push({
            id: item.id,
            tone: 'bad',
            icon: <Flag size={18} strokeWidth={2} aria-hidden="true" />,
            text: (
              <>
                <strong>{formatRequestId(item.pickupRequestId)}</strong> flagged by the Validator
                {item.flagReason ? ` — ${item.flagReason}` : null}
              </>
            ),
            time: 'Recently',
          })
        })
        ;(recentComplaints.items || []).slice(0, 4 - activity.length).forEach((item) => {
          activity.push({
            id: item.id,
            tone: item.status === 'Open' ? 'warn' : 'ok',
            icon: <MessageSquare size={18} strokeWidth={2} aria-hidden="true" />,
            text: (
              <>
                New complaint <strong>{formatRequestId(item.id, 'CMP')}</strong>
                {item.description ? ` · ${item.description.slice(0, 40)}` : null}
              </>
            ),
            time: formatDate(item.createdAt),
          })
        })
        setRecentActivity(activity)
      } catch (err) {
        if (!cancelled) setError(controller.signal.aborted
          ? 'The dashboard took too long to respond. Please try again.'
          : err.message)
      } finally {
        clearTimeout(timeout)
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      clearTimeout(timeout)
      controller.abort()
    }
  }, [loadAttempt])

  // The map's waiting/due badges come from the same report the Zones page uses.
  useEffect(() => {
    let cancelled = false
    apiRequest('/routes/zone-load')
      .then((data) => {
        if (!cancelled) setZoneLoad(Array.isArray(data) ? data : data?.items ?? [])
      })
      .catch(() => {
        // The map still draws without the badges, so a failure here is not
        // worth taking over the page with an error banner.
      })
    return () => { cancelled = true }
  }, [])

  const loadByZone = useMemo(
    () => new Map(zoneLoad.map((row) => [row.zoneId, row])),
    [zoneLoad],
  )

  const collectorName = useMemo(() => (zone) => {
    if (!zone.assignedCollectorId) return null
    return shortProfileName(catalog.profileMap.get(zone.assignedCollectorId))
  }, [catalog.profileMap])

  // Categories are counted from the open requests the catalog already holds,
  // because the API has no aggregate-by-category endpoint. The subtitle says so
  // rather than implying this covers every request ever made.
  const categoryRows = useMemo(() => {
    const counts = new Map()
    catalog.pickups.forEach((pickup) => {
      if (!pickup.category) return
      counts.set(pickup.category, (counts.get(pickup.category) || 0) + 1)
    })
    return CATEGORY_ORDER
      .filter((key) => counts.has(key))
      .map((key) => ({ label: CATEGORY_LABELS[key] || key, value: counts.get(key), key }))
  }, [catalog.pickups])

  const pipeline = [
    { name: 'Classified', value: stats?.classified ?? 0, Icon: ScanSearch },
    { name: 'Routed', value: stats?.routed ?? 0, Icon: Route },
    { name: 'Validated', value: stats?.validated ?? 0, Icon: ShieldCheck },
    { name: 'Flagged', value: stats?.flagged ?? 0, Icon: Flag, flag: true },
  ]
  const pipelineMax = Math.max(...pipeline.map((stage) => stage.value), 1)

  const collectedPct = stats?.requestsToday
    ? Math.round((stats.collectedToday / stats.requestsToday) * 100)
    : 0

  if (loading) {
    return (
      <PageShell title="Dashboard" showDate showSearch showBell>
        <p className="ac-empty">Loading dashboard…</p>
      </PageShell>
    )
  }

  if (!stats) {
    return (
      <PageShell title="Dashboard" showDate showSearch showBell>
        <AcCard title="Couldn’t load the dashboard" subtitle="Your data hasn’t loaded yet. Try again to reconnect.">
          <AcAlert message={error} />
          <button type="button" className="ac-btn ac-btn-primary" onClick={() => {
            setLoading(true)
            setError(null)
            setLoadAttempt((attempt) => attempt + 1)
            catalog.refresh()
          }}>Try again</button>
        </AcCard>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Dashboard"
      showDate
      showSearch
      showBell
      hasAlerts={(stats?.pendingApprovals ?? 0) > 0}
      searchValue={search}
      onSearchChange={setSearch}
    >
      <AcAlert message={error} onClose={() => setError(null)} />

      <div className="ac-grid ac-g4">
        <AcKpi
          label="Requests today"
          icon={<Inbox size={18} strokeWidth={2} aria-hidden="true" />}
          value={stats?.requestsToday ?? 0}
          foot="Pending and collected"
        />
        <AcKpi
          label="Pending approval"
          icon={<ShieldCheck size={18} strokeWidth={2} aria-hidden="true" />}
          value={stats?.pendingApprovals ?? 0}
          alert={(stats?.pendingApprovals ?? 0) > 0}
          foot={(
            <Link className="ac-link-btn" to="/admin/approvals">
              Review now <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
            </Link>
          )}
        />
        <AcKpi
          label="Collected"
          icon={<Truck size={18} strokeWidth={2} aria-hidden="true" />}
          value={stats?.collectedToday ?? 0}
          unit={`/ ${stats?.requestsToday ?? 0}`}
          foot={(
            <>
              <span className="ac-meter" style={{ flex: 1 }}>
                <i style={{ width: `${collectedPct}%` }} />
              </span>
              {collectedPct}%
            </>
          )}
        />
        <AcKpi
          label="Open complaints"
          icon={<MessageSquare size={18} strokeWidth={2} aria-hidden="true" />}
          value={stats?.openComplaints ?? 0}
          foot={`${stats?.resolvedRate ?? 0}% resolved overall`}
        />
      </div>

      <div className="ac-grid ac-g-2-1">
        <AcCard title="Agent pipeline" subtitle="Requests moving through the four agents">
          <div className="ac-pipe">
            {pipeline.map(({ name, value, Icon, flag }) => (
              <div className="ac-stage" key={name}>
                <div className="ac-stage-col">
                  <div
                    className={`ac-stage-bar${flag ? ' is-flag' : ''}`}
                    style={{ height: `${Math.max(6, (value / pipelineMax) * 100)}%` }}
                  >
                    <span>{value}</span>
                  </div>
                </div>
                <div className="ac-stage-name">
                  <Icon size={15} strokeWidth={2} aria-hidden="true" />
                  {name}
                </div>
              </div>
            ))}
          </div>
          <p className="ac-pipe-note">
            Counts come from the pickup and approval records, not from a sample.
          </p>
        </AcCard>

        <AcCard
          title="Needs your attention"
          subtitle={`${flagged.length} flagged by the Validator`}
          action={(
            <Link className="ac-link-btn" to="/admin/approvals">
              Open queue <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
            </Link>
          )}
        >
          {flagged.length === 0 ? (
            <p className="ac-empty">Nothing is waiting for approval.</p>
          ) : (
            <ul className="ac-list">
              {flagged.map((item) => (
                <li className="ac-row" key={item.id}>
                  <span className="ac-ic bad"><Flag size={18} strokeWidth={2} aria-hidden="true" /></span>
                  <span className="ac-grow">
                    <strong>{formatRequestId(item.pickupRequestId)}</strong>
                    <span className="ac-sub">{item.flagReason || 'Flagged for review'}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AcCard>
      </div>

      <div className="ac-grid ac-g-2-1">
        <AcCard
          title="Zone load"
          subtitle="Pickups waiting per zone. Tap a truck for details"
          action={(
            <Link className="ac-link-btn" to="/admin/routes">
              Manage zones <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
            </Link>
          )}
        >
          <ZoneMap zones={catalog.zones} loadByZone={loadByZone} collectorName={collectorName} />
        </AcCard>

        <AcCard
          title="Open requests by category"
          subtitle="From the Classifier, across requests not yet collected"
        >
          <AcBars rows={categoryRows} renderIcon={(row) => <AcCategoryIcon category={row.key} />} />
        </AcCard>
      </div>

      <AcCard title="Recent activity">
        {recentActivity.length === 0 ? (
          <p className="ac-empty">No recent activity yet.</p>
        ) : (
          <ul className="ac-list">
            {recentActivity.map((item) => (
              <li className="ac-row" key={item.id}>
                <span className={`ac-ic ${item.tone}`}>{item.icon}</span>
                <span className="ac-grow">{item.text}</span>
                <span className="ac-time">{item.time}</span>
              </li>
            ))}
          </ul>
        )}
      </AcCard>
    </PageShell>
  )
}
