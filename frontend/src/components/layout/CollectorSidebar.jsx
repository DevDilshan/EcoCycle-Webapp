import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const menuItems = [
  { to: '/collector', label: 'Overview', end: true },
  { to: '/collector/route', label: "Today's Route" },
  { to: '/collector/assign', label: 'Assign Pickup' },
  { to: '/collector/classify', label: 'Classify Pickup' },
]

function initials(email) {
  if (!email) return '?'
  return email.charAt(0).toUpperCase()
}

export default function CollectorSidebar() {
  const { user, role, signOut } = useAuth()

  return (
    <aside className="admin-sidebar collector-sidebar">
      <div className="admin-sidebar-brand">
        <div className="admin-logo">♻</div>
        <div>
          <p className="admin-sidebar-title">EcoCycle</p>
          <p className="admin-sidebar-subtitle">Collector portal</p>
        </div>
      </div>

      <nav className="admin-nav" aria-label="Collector navigation">
        <p className="admin-nav-section">Menu</p>
        {menuItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `admin-nav-link${isActive ? ' admin-nav-link-active' : ''}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        <span className="admin-role-badge admin-role-badge-sidebar">{role ?? 'collector'}</span>
        <NavLink
          to="/collector/account"
          className={({ isActive }) =>
            `admin-user-chip admin-user-chip-sidebar admin-user-chip-button${
              isActive ? ' admin-user-chip-active' : ''
            }`
          }
          title="Account settings"
        >
          <span className="admin-avatar" aria-hidden>{initials(user?.email)}</span>
          <span className="admin-user-email">{user?.email}</span>
        </NavLink>
        <button type="button" onClick={signOut} className="admin-sidebar-logout">
          Logout
        </button>
      </div>
    </aside>
  )
}
