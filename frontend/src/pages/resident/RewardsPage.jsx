import { useCallback, useEffect, useState } from 'react'
import { Gift, Recycle, Trophy } from 'lucide-react'
import PageShell from '../../components/admin/AdminPageShell'
import { AcAlert, AcCard, AcKpi, AcToast } from '../../components/admin/AcUi'
import MyRedemptions from '../../components/resident/MyRedemptions'
import { useAuth } from '../../context/AuthContext'
import { MEDAL_ICONS, profileInitials, shortProfileName } from '../../lib/adminUi'
import { apiRequest, formatDate, shortId } from '../../lib/api'

export default function ResidentRewardsPage() {
  const { user, role } = useAuth()
  const [history, setHistory] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [page, setPage] = useState(1)
  const [showRedeem, setShowRedeem] = useState(false)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: '10' })
      const [historyData, leaders] = await Promise.all([
        apiRequest(`/rewards/${user.id}/history?${query}`),
        apiRequest('/rewards/leaderboard?limit=10'),
      ])
      setHistory(historyData)
      setLeaderboard(leaders)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user?.id, page])

  useEffect(() => { load() }, [load])

  const totalPages = history?.totalPages ?? 1
  const myEntry = leaderboard.find((entry) => entry.residentId === user?.id)
  const balance = history?.currentBalance ?? 0

  return (
    <PageShell
      title="Rewards"
      description="Your points, redemptions and where you stand this month"
      actions={(
        <button
          type="button"
          className="ac-btn ac-btn-primary ac-btn-sm"
          onClick={() => setShowRedeem((open) => !open)}
        >
          <Gift size={15} strokeWidth={2.2} aria-hidden="true" />
          Request redemption
        </button>
      )}
    >
      {role !== 'resident' && (
        <AcAlert message="Requesting a redemption requires the resident role." />
      )}
      <AcAlert message={error} onClose={() => setError(null)} />

      <section className="r-hero">
        <div>
          <p className="r-hero-label">Your balance</p>
          <p className="r-hero-value">
            {balance.toLocaleString()}<small>pts</small>
          </p>
        </div>
        <div className="r-hero-meta">
          <div className="r-hero-stat">
            <span>
              <Recycle size={13} strokeWidth={2.4} aria-hidden="true" />
              Transactions
            </span>
            <strong>{history?.totalCount ?? 0}</strong>
          </div>
          <div className="r-hero-stat">
            <span>
              <Trophy size={13} strokeWidth={2.4} aria-hidden="true" />
              Your rank
            </span>
            <strong>{myEntry ? `#${myEntry.rank}` : '—'}</strong>
          </div>
        </div>
      </section>

      <div className="ac-grid ac-g3">
        <AcKpi
          label="Points available"
          icon={<Gift size={18} strokeWidth={2} aria-hidden="true" />}
          value={balance.toLocaleString()}
          foot="Ready to spend"
        />
        <AcKpi
          label="Earned this month"
          icon={<Recycle size={18} strokeWidth={2} aria-hidden="true" />}
          value={(myEntry?.pointsEarned ?? 0).toLocaleString()}
          foot="Counts towards your rank"
        />
        <AcKpi
          label="Zone rank"
          icon={<Trophy size={18} strokeWidth={2} aria-hidden="true" />}
          value={myEntry ? `#${myEntry.rank}` : '—'}
          foot="Against your neighbours"
        />
      </div>

      <MyRedemptions
        canRequest={role === 'resident'}
        balance={balance}
        showForm={showRedeem}
        onCloseForm={() => setShowRedeem(false)}
        onError={setError}
        onSuccess={setSuccess}
        onChanged={load}
      />

      <div className="ac-grid ac-g-1-1">
        <AcCard title="Leaderboard" subtitle="This month, in your zone">
          {leaderboard.length === 0 ? (
            <p className="ac-empty">No leaderboard data yet.</p>
          ) : (
            <ul className="ac-list">
              {leaderboard.map((entry, index) => {
                const isMe = entry.residentId === user?.id
                const name = isMe
                  ? 'You'
                  : (entry.residentName || shortProfileName({ id: entry.residentId }))
                return (
                  <li className="ac-row" key={entry.residentId}>
                    <span className={`ac-rank${index === 0 ? ' is-top' : ''}`}>
                      {MEDAL_ICONS[index] || index + 1}
                    </span>
                    <span className="ac-avatar" aria-hidden="true">{profileInitials(name)}</span>
                    <span className="ac-grow">
                      <strong>{name}</strong>
                      <span className="ac-sub">
                        {isMe ? 'Your rank this month' : 'Active recycler'}
                      </span>
                    </span>
                    <span className="ac-v">{entry.pointsEarned.toLocaleString()}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </AcCard>

        <AcCard title="Points history" subtitle="Every change to your balance">
          {loading ? (
            <p className="ac-loading">Loading history…</p>
          ) : !history?.items?.length ? (
            <p className="ac-empty">No reward transactions yet.</p>
          ) : (
            <>
              <ul className="ac-list">
                {history.items.map((item) => (
                  <li className="ac-row" key={item.id}>
                    <span className="ac-ic">
                      <Recycle size={18} strokeWidth={2} aria-hidden="true" />
                    </span>
                    <span className="ac-grow">
                      <strong>{item.reason}</strong>
                      <span className="ac-sub">
                        {formatDate(item.createdAt)} ·{' '}
                        {item.pickupRequestId ? shortId(item.pickupRequestId) : 'Manual'}
                      </span>
                    </span>
                    {/* Spent points read as a loss, so the sign is kept and the
                        colour follows it rather than showing every row green. */}
                    <span className={`ac-pill ${item.pointsEarned < 0 ? 'ac-s-bad' : 'ac-s-ok'}`}>
                      {item.pointsEarned > 0 ? `+${item.pointsEarned}` : item.pointsEarned}
                    </span>
                  </li>
                ))}
              </ul>
              {totalPages > 1 && (
                <div className="ac-pagination">
                  <button
                    type="button"
                    className="ac-btn ac-btn-ghost ac-btn-sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </button>
                  <span>Page {page} of {totalPages}</span>
                  <button
                    type="button"
                    className="ac-btn ac-btn-ghost ac-btn-sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </AcCard>
      </div>

      <AcToast message={success} onDone={() => setSuccess(null)} />
    </PageShell>
  )
}
