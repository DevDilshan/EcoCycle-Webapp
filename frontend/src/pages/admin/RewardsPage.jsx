import { useCallback, useEffect, useMemo, useState } from 'react'
import { Award, Gift, History, Inbox, ListChecks, Trophy, Users, Wand2 } from 'lucide-react'
import PageShell from '../../components/admin/AdminPageShell'
import { AcAlert, AcCard, AcKpi } from '../../components/admin/AcUi'
import AcHubCard from '../../components/admin/AcHubCard'
import { useAdminCatalog } from '../../hooks/useAdminCatalog'
import { profileInitials, shortProfileName } from '../../lib/adminUi'
import { apiRequest } from '../../lib/api'

export default function RewardsPage() {
  const catalog = useAdminCatalog()
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState({ items: null, activeItems: null, pending: null })

  const loadLeaderboard = useCallback(
    () => apiRequest('/rewards/leaderboard?limit=20')
      .then(setLeaderboard)
      .catch(() => {})
      .finally(() => setLoading(false)),
    [],
  )

  // The numbers shown on the tiles.
  const loadCounts = useCallback(
    () => Promise.all([
      apiRequest('/reward-items?pageSize=100'),
      apiRequest('/redemptions?status=Pending&pageSize=1'),
    ])
      .then(([items, pending]) => setCounts({
        items: items.totalCount,
        activeItems: items.items.filter((i) => i.isActive).length,
        pending: pending.totalCount,
      }))
      // The tiles still work without their counts.
      .catch(() => {}),
    [],
  )

  useEffect(() => { loadLeaderboard() }, [loadLeaderboard])
  useEffect(() => { loadCounts() }, [loadCounts])

  // Only what the leaderboard actually reports.
  const stats = useMemo(() => {
    const totalPoints = leaderboard.reduce((sum, entry) => sum + (entry.pointsEarned || 0), 0)
    return {
      pointsIssued: totalPoints,
      activeRecyclers: leaderboard.length,
      topScore: leaderboard[0]?.pointsEarned ?? 0,
    }
  }, [leaderboard])

  const pending = counts.pending

  return (
    <PageShell
      title="Rewards"
      description="Points, the reward catalog and redemption requests"
      showBell
    >
      <AcAlert message={catalog.error} />

      <div className="ac-grid ac-g3">
        <AcKpi
          label="Points issued"
          icon={<Award size={18} strokeWidth={2} aria-hidden="true" />}
          value={stats.pointsIssued.toLocaleString()}
          foot="Across everyone on the leaderboard"
        />
        <AcKpi
          label="Residents earning"
          icon={<Users size={18} strokeWidth={2} aria-hidden="true" />}
          value={stats.activeRecyclers.toLocaleString()}
          foot="With at least one reward"
        />
        <AcKpi
          label="Top score"
          icon={<Trophy size={18} strokeWidth={2} aria-hidden="true" />}
          value={stats.topScore.toLocaleString()}
          foot={leaderboard[0]?.residentName || 'No points recorded yet'}
        />
      </div>

      <AcCard title="Leaderboard" subtitle="Residents ranked by points earned">
        {loading ? (
          <p className="ac-empty">Loading leaderboard…</p>
        ) : leaderboard.length === 0 ? (
          <p className="ac-empty">No points recorded yet.</p>
        ) : (
          <ul className="ac-list">
            {leaderboard.slice(0, 10).map((entry, index) => {
              const profile = catalog.profileMap.get(entry.residentId)
              const name = entry.residentName || shortProfileName(profile)
              const share = stats.topScore ? (entry.pointsEarned / stats.topScore) * 100 : 0
              return (
                <li className="ac-row" key={entry.residentId}>
                  <span className={`ac-rank${index === 0 ? ' is-top' : ''}`}>
                    {entry.rank ?? index + 1}
                  </span>
                  <span className="ac-avatar" aria-hidden="true">{profileInitials(name)}</span>
                  <span className="ac-grow"><strong>{name}</strong></span>
                  <span className="ac-mini-meter">
                    <span className="ac-meter"><i style={{ width: `${share}%` }} /></span>
                  </span>
                  <span className="ac-v">{entry.pointsEarned.toLocaleString()}</span>
                </li>
              )
            })}
          </ul>
        )}
      </AcCard>

      <h2 className="ac-section-title">Manage rewards</h2>
      <div className="ac-hub">
        <AcHubCard
          to="/admin/rewards/catalog"
          icon={<Gift size={28} strokeWidth={1.8} />}
          eyebrow="Catalog"
          title="Reward items"
          description="Add, price and stock what residents can spend their points on."
          meta={counts.items == null ? ' ' : `${counts.items} items · ${counts.activeItems} available`}
          action="Open catalog"
        />
        <AcHubCard
          to="/admin/rewards/requests"
          icon={<Inbox size={28} strokeWidth={1.8} />}
          eyebrow="Requests"
          title="Redemptions"
          description="Residents ask to spend points. Approve to deduct them, or decline with a note."
          meta={pending == null ? ' ' : pending === 0 ? 'Nothing waiting' : `${pending} waiting for review`}
          action="Review requests"
          attention={pending > 0}
        />
        <AcHubCard
          to="/admin/rewards/history"
          icon={<History size={28} strokeWidth={1.8} />}
          eyebrow="Ledger"
          title="Points history"
          description="Look up a resident's points, then correct or reverse an entry."
          meta="Edit · reverse"
          action="Open history"
        />
        <AcHubCard
          to="/admin/rewards/award"
          icon={<Wand2 size={28} strokeWidth={1.8} />}
          eyebrow="Bonus"
          title="Give points"
          description="Points are added automatically when a pickup is collected. Use this for goodwill."
          meta="Manual award"
          action="Award points"
        />
        <AcHubCard
          to="/admin/rewards/check"
          icon={<ListChecks size={28} strokeWidth={1.8} />}
          eyebrow="Rules"
          title="Check a pickup"
          description="Test a classified pickup against the reward rules: hazardous waste and the bulk limit."
          meta="Dry run, changes nothing"
          action="Run a check"
        />
      </div>
    </PageShell>
  )
}
