import { Fragment, useCallback, useEffect, useState } from 'react'
import PageShell from '../../components/PageShell'
import AdminAlert from '../../components/admin/AdminAlert'
import AdminCard from '../../components/admin/AdminCard'
import StatusBadge from '../../components/admin/StatusBadge'
import { useAuth } from '../../context/AuthContext'
import { formatCompletionStatus, isRoutePending } from '../../lib/collector'
import { apiRequest, formatDate, shortId } from '../../lib/api'

export default function CollectorRoutePage() {
  const { user, role } = useAuth()
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [issueNotes, setIssueNotes] = useState('')

  const load = useCallback(async () => {
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
  }, [user?.id])

  useEffect(() => { load() }, [load])

  async function handleComplete(routeId) {
    setBusyId(routeId)
    setError(null)
    setSuccess(null)
    try {
      await apiRequest(`/routes/${routeId}/complete`, {
        method: 'PATCH',
        body: JSON.stringify({ issueNotes: issueNotes.trim() || undefined }),
      })
      setSuccess('Route stop marked complete.')
      setIssueNotes('')
      setExpandedId(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <PageShell
      eyebrow="Collector"
      title="Today's route"
      description="View and complete your scheduled pickup stops."
    >
      {role !== 'collector' && (
        <AdminAlert type="error" message="Route completion requires the collector role." />
      )}
      <AdminAlert type="error" message={error} onClose={() => setError(null)} />
      <AdminAlert type="success" message={success} onClose={() => setSuccess(null)} />

      <AdminCard title="Assignments" subtitle="GET /api/routes/{collectorId}/today">
        {loading ? (
          <p className="admin-loading">Loading today's route…</p>
        ) : routes.length === 0 ? (
          <p className="admin-empty">No assignments scheduled for today.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Route ID</th>
                  <th>Pickup</th>
                  <th>Zone</th>
                  <th>Scheduled</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {routes.map((route) => (
                  <Fragment key={route.id}>
                    <tr>
                      <td>{shortId(route.id)}</td>
                      <td>{shortId(route.pickupRequestId)}</td>
                      <td>{shortId(route.zoneId)}</td>
                      <td>{formatDate(route.scheduledDate)}</td>
                      <td>
                        <StatusBadge status={formatCompletionStatus(route.completionStatus)} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => {
                            if (expandedId === route.id) {
                              setExpandedId(null)
                              return
                            }
                            setIssueNotes(route.issueNotes || '')
                            setExpandedId(route.id)
                          }}
                        >
                          {expandedId === route.id ? 'Hide' : 'Details'}
                        </button>
                      </td>
                    </tr>
                    {expandedId === route.id && (
                      <tr>
                        <td colSpan={6}>
                          <div className="admin-panel">
                            <p><strong>Created:</strong> {formatDate(route.createdAt)}</p>
                            {route.completedAt && (
                              <p><strong>Completed:</strong> {formatDate(route.completedAt)}</p>
                            )}
                            {route.issueNotes && (
                              <p><strong>Issue notes:</strong> {route.issueNotes}</p>
                            )}
                            {isRoutePending(route.completionStatus) && (
                              <div className="admin-form" style={{ marginTop: '1rem' }}>
                                <div>
                                  <label htmlFor={`issue-${route.id}`}>Issue notes (optional)</label>
                                  <textarea
                                    id={`issue-${route.id}`}
                                    value={issueNotes}
                                    onChange={(e) => setIssueNotes(e.target.value)}
                                    placeholder="Note any issues encountered at this stop…"
                                  />
                                </div>
                                <div className="admin-actions">
                                  <button
                                    type="button"
                                    className="btn-primary btn-sm"
                                    disabled={busyId === route.id}
                                    onClick={() => handleComplete(route.id)}
                                  >
                                    Mark complete
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </PageShell>
  )
}
