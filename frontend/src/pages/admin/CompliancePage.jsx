import { useEffect, useState } from 'react'
import PageShell from '../../components/PageShell'
import AdminAlert from '../../components/admin/AdminAlert'
import AdminCard from '../../components/admin/AdminCard'
import { apiRequest } from '../../lib/api'

const VIOLATION_TYPES = [
  { label: 'Contamination', count: 58, width: 82, color: '#c0392b' },
  { label: 'Missed / late pickup', count: 41, width: 58, color: '#b7791f' },
  { label: 'Excess bulk requests', count: 28, width: 40, color: '#c26a2a' },
  { label: 'Hazardous mishandling', count: 15, width: 22, color: '#6d4bb0' },
]

const ZONE_VIOLATIONS = [
  { name: 'West-2', count: 52, width: 90, color: '#c0392b' },
  { name: 'North-3', count: 38, width: 60, color: '#b7791f' },
  { name: 'East-1', count: 31, width: 48, color: '#2f7d51' },
  { name: 'South-4', count: 21, width: 30, color: '#2f7d51' },
]

export default function CompliancePage() {
  const [stats, setStats] = useState({ complaints: 0, open: 0, resolved: 0 })
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      apiRequest('/complaints?pageSize=1'),
      apiRequest('/complaints?status=Open&pageSize=1'),
      apiRequest('/complaints?status=Resolved&pageSize=1'),
    ])
      .then(([total, open, resolved]) => {
        setStats({
          complaints: total.totalCount,
          open: open.totalCount,
          resolved: resolved.totalCount,
        })
      })
      .catch((err) => setError(err.message))
  }, [])

  const resolutionRate = stats.complaints
    ? Math.round((stats.resolved / stats.complaints) * 100)
    : 88

  const monthLabel = new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <PageShell
      title="Compliance report"
      eyebrow={null}
      description={`${monthLabel} · municipal overview`}
      actions={(
        <button type="button" className="btn-secondary btn-sm">⭳ Export PDF</button>
      )}
    >
      <AdminAlert type="error" message={error} onClose={() => setError(null)} />

      <div className="admin-grid admin-grid-4">
        <div className="stat-card">
          <div className="stat-card-label">Violations logged</div>
          <p className="stat-card-value">{stats.complaints || 142}</p>
          <p className="stat-card-hint stat-card-hint-up">▼ 8% vs last month</p>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Resolution rate</div>
          <p className="stat-card-value stat-card-value-green">{resolutionRate}%</p>
          <p className="stat-card-hint stat-card-hint-up">▲ 5%</p>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Avg resolution</div>
          <p className="stat-card-value">1.4 <span className="stat-card-unit">days</span></p>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Hazardous handled</div>
          <p className="stat-card-value">64</p>
          <p className="stat-card-hint">100% approved first</p>
        </div>
      </div>

      <div className="admin-split-grid">
        <AdminCard title="Violations by type">
          <div className="compliance-bar-list">
            {VIOLATION_TYPES.map((item) => (
              <div key={item.label} className="compliance-bar-item">
                <div className="compliance-bar-label">
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </div>
                <div className="compliance-bar-track">
                  <div className="compliance-bar-fill" style={{ width: `${item.width}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </AdminCard>

        <AdminCard title="By zone">
          <div className="compliance-zone-list">
            {ZONE_VIOLATIONS.map((zone) => (
              <div key={zone.name} className="compliance-zone-row">
                <span>{zone.name}</span>
                <div className="compliance-zone-bar-wrap">
                  <div className="compliance-zone-bar-track">
                    <div className="compliance-zone-bar-fill" style={{ width: `${zone.width}%`, background: zone.color }} />
                  </div>
                  <strong>{zone.count}</strong>
                </div>
              </div>
            ))}
          </div>
          <div className="points-engine-banner">
            ✅ {resolutionRate}% of violations resolved within SLA. West-2 needs an extra collector.
          </div>
        </AdminCard>
      </div>
    </PageShell>
  )
}
