import { useCallback, useEffect, useState } from 'react'
import PageShell from '../../components/PageShell'
import AdminAlert from '../../components/admin/AdminAlert'
import AdminCard from '../../components/admin/AdminCard'
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
  const [busy, setBusy] = useState(false)
  const [page, setPage] = useState(1)
  const [showRedeem, setShowRedeem] = useState(false)
  const [redeemForm, setRedeemForm] = useState({ points: 50, reason: '' })

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

  async function handleRedeem(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await apiRequest('/rewards/redeem', {
        method: 'POST',
        body: JSON.stringify(redeemForm),
      })
      setSuccess(`Redeemed ${redeemForm.points} points. Remaining balance: ${result.remainingBalance}.`)
      setRedeemForm({ points: 50, reason: '' })
      setShowRedeem(false)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const totalPages = history?.totalPages ?? 1
  const myEntry = leaderboard.find((entry) => entry.residentId === user?.id)

  return (
    <PageShell
      title="Rewards & recycling"
      eyebrow={null}
      description="View your points balance, redeem rewards, and compare on the leaderboard."
      actions={(
        <button type="button" className="btn-primary btn-sm" onClick={() => setShowRedeem((v) => !v)}>
          Redeem points
        </button>
      )}
    >
      {role !== 'resident' && (
        <AdminAlert type="error" message="Redeeming points requires the resident role." />
      )}
      <AdminAlert type="error" message={error} onClose={() => setError(null)} />
      <AdminAlert type="success" message={success} onClose={() => setSuccess(null)} />

      <div className="resident-rewards-hero">
        <p className="resident-rewards-label">Your balance</p>
        <p className="resident-rewards-value">
          {(history?.currentBalance ?? 0).toLocaleString()} <span>pts</span>
        </p>
        <div className="resident-rewards-meta">
          <div>
            <span>Transactions</span>
            <strong>{history?.totalCount ?? 0}</strong>
          </div>
          <div>
            <span>Your rank</span>
            <strong>{myEntry ? `#${myEntry.rank}` : '—'}</strong>
          </div>
        </div>
      </div>

      <div className="admin-grid admin-grid-4">
        <div className="stat-card">
          <div className="stat-card-label">Current balance</div>
          <p className="stat-card-value">{history?.currentBalance ?? 0}</p>
          <p className="stat-card-hint stat-card-hint-up">Points available</p>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Transactions</div>
          <p className="stat-card-value">{history?.totalCount ?? 0}</p>
          <p className="stat-card-hint">Total recorded</p>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Zone rank</div>
          <p className="stat-card-value stat-card-value-green">{myEntry ? `#${myEntry.rank}` : '—'}</p>
          <p className="stat-card-hint stat-card-hint-up">This month</p>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Points earned</div>
          <p className="stat-card-value">{myEntry?.pointsEarned ?? 0}</p>
          <p className="stat-card-hint">Leaderboard total</p>
        </div>
      </div>

      {showRedeem && (
        <AdminCard title="Redeem points">
          <form className="admin-form" onSubmit={handleRedeem}>
            <div className="admin-form-row">
              <div>
                <label>Points to redeem</label>
                <input type="number" min="1" value={redeemForm.points} onChange={(e) => setRedeemForm({ ...redeemForm, points: Number(e.target.value) })} required />
              </div>
              <div>
                <label>Reason</label>
                <input value={redeemForm.reason} onChange={(e) => setRedeemForm({ ...redeemForm, reason: e.target.value })} placeholder="e.g. Voucher redemption" required />
              </div>
            </div>
            <div className="admin-actions">
              <button type="submit" className="btn-primary btn-sm" disabled={busy || role !== 'resident'}>Redeem</button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setShowRedeem(false)}>Cancel</button>
            </div>
          </form>
        </AdminCard>
      )}

      <div className="admin-split-grid">
        <AdminCard title="🏆 Leaderboard · this month">
          {leaderboard.length === 0 ? (
            <p className="admin-empty">No leaderboard data yet.</p>
          ) : (
            <ul className="leaderboard-list">
              {leaderboard.map((entry, index) => {
                const isMe = entry.residentId === user?.id
                const name = isMe ? 'You' : (entry.residentName || shortProfileName({ id: entry.residentId }))
                return (
                  <li key={entry.residentId} className={`leaderboard-row${index === 0 ? ' leaderboard-row-top' : ''}${isMe ? ' leaderboard-row-me' : ''}`}>
                    <span className="leaderboard-rank">{MEDAL_ICONS[index] || index + 1}</span>
                    <span className="leaderboard-avatar">{profileInitials(name)}</span>
                    <div className="leaderboard-info">
                      <strong>{name}</strong>
                      <small>{isMe ? 'Your rank this month' : 'Active recycler'}</small>
                    </div>
                    <span className="leaderboard-points">{entry.pointsEarned.toLocaleString()}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </AdminCard>

        <AdminCard title="Transaction history">
          {loading ? (
            <p className="admin-loading">Loading history…</p>
          ) : !history?.items?.length ? (
            <p className="admin-empty">No reward transactions yet.</p>
          ) : (
            <>
              <ul className="resident-activity-list">
                {history.items.map((item) => (
                  <li key={item.id} className="resident-activity-item">
                    <span className="resident-activity-icon">♻️</span>
                    <div className="resident-activity-body">
                      <strong>{item.reason}</strong>
                      <small>{formatDate(item.createdAt)} · {item.pickupRequestId ? shortId(item.pickupRequestId) : 'Manual'}</small>
                    </div>
                    <span className={`leaderboard-points${item.pointsEarned < 0 ? ' text-danger' : ''}`}>
                      {item.pointsEarned > 0 ? `+${item.pointsEarned}` : item.pointsEarned}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="admin-pagination">
                <button type="button" className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
                <span className="admin-pagination-meta">Page {page} of {totalPages}</span>
                <button type="button" className="btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            </>
          )}
        </AdminCard>
      </div>
    </PageShell>
  )
}
