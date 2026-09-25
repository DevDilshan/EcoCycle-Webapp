import { useEffect, useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { loadStoredApprovals } from '../../lib/approvals'
import { profileInitials, shortProfileName } from '../../lib/adminUi'

const menuItems = [
  { to: '/admin', label: 'Overview', icon: '▦', end: true, activeVariant: 'green' },
  { to: '/admin/pickup-requests', label: 'Requests', icon: '🗂️', activeVariant: 'green' },
  { to: '/admin/approvals', label: 'Approvals', icon: '✅', badge: true, activeVariant: 'danger' },
  { to: '/admin/routes', label: 'Zones & Routes', icon: '🗺️', activeVariant: 'purple' },
  { to: '/admin/rewards', label: 'Rewards', icon: '🏆', activeVariant: 'gold' },
  { to: '/admin/complaints', label: 'Complaints', icon: '💬', activeVariant: 'danger' },
  { to: '/admin/compliance', label: 'Compliance', icon: '📊', activeVariant: 'green' },
]

export default function Sidebar() {
  const { user, signOut } = useAuth()
  const [approvalCount, setApprovalCount] = useState(0)

  useEffect(() => {
    function refreshCount() {
      setApprovalCount(loadStoredApprovals().length)
    }
    refreshCount()
    window.addEventListener('storage', refreshCount)
    window.addEventListener('ecocycle-approvals-updated', refreshCount)
    return () => {
      window.removeEventListener('storage', refreshCount)
      window.removeEventListener('ecocycle-approvals-updated', refreshCount)
    }
  }, [])

  const displayName = shortProfileName({ email: user?.email, fullName: user?.user_metadata?.full_name })

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <div className="admin-logo">E</div>
        <p className="admin-sidebar-title">EcoCycle</p>
      </div>

      <nav className="admin-nav" aria-label="Admin navigation">
        <p className="admin-nav-section">Main</p>
        {menuItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => {
              let cls = 'admin-nav-link'
              if (isActive) {
                cls += ` admin-nav-link-active-${item.activeVariant || 'green'}`
              }
              return cls
            }}
          >
            <span className="admin-nav-icon" aria-hidden>{item.icon}</span>
            <span className="admin-nav-label">{item.label}</span>
            {item.badge && approvalCount > 0 && (
              <span className="admin-nav-badge">{approvalCount}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        <NavLink
          to="/admin/account"
          className={({ isActive }) =>
            `admin-sidebar-user${isActive ? ' admin-sidebar-user-active' : ''}`
          }
          title="Account settings"
        >
          <span className="admin-avatar" aria-hidden>{profileInitials(displayName)}</span>
          <span className="admin-sidebar-user-text">
            <span className="admin-sidebar-user-name">{displayName}</span>
            <span className="admin-sidebar-user-role">Municipal Admin</span>
          </span>
        </NavLink>
        <div className="admin-sidebar-footer-links">
          <Link to="/" className="admin-sidebar-link">Back to site</Link>
          <button type="button" onClick={signOut} className="admin-sidebar-link admin-sidebar-link-button">
            Logout
          </button>
        </div>
      </div>
    </aside>
  )
}
