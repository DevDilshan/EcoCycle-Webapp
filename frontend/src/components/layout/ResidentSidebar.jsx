import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { profileInitials, shortProfileName } from '../../lib/adminUi'

const menuItems = [
  { to: '/dashboard', label: 'Overview', icon: '▦', end: true, activeVariant: 'green' },
  { to: '/dashboard/pickups', label: 'My Pickups', icon: '🗂️', activeVariant: 'green' },
  { to: '/dashboard/rewards', label: 'Rewards', icon: '🏆', activeVariant: 'gold' },
  { to: '/dashboard/complaints', label: 'Complaints', icon: '💬', activeVariant: 'danger' },
]

export default function ResidentSidebar() {
  const { user, signOut } = useAuth()
  const displayName = shortProfileName({
    email: user?.email,
    fullName: user?.user_metadata?.full_name,
  })

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <div className="admin-logo">E</div>
        <p className="admin-sidebar-title">EcoCycle</p>
      </div>

      <nav className="admin-nav" aria-label="Resident navigation">
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
          </NavLink>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        <NavLink
          to="/dashboard/account"
          className={({ isActive }) =>
            `admin-sidebar-user${isActive ? ' admin-sidebar-user-active' : ''}`
          }
          title="Account settings"
        >
          <span className="admin-avatar" aria-hidden>{profileInitials(displayName)}</span>
          <span className="admin-sidebar-user-text">
            <span className="admin-sidebar-user-name">{displayName}</span>
            <span className="admin-sidebar-user-role">Resident</span>
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
