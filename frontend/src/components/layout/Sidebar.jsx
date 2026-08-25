import { NavLink } from 'react-router-dom'

const menuItems = [
  { to: '/admin', label: 'Overview', icon: '📊', end: true },
  { to: '/admin/pickup-requests', label: 'Pickup Requests', icon: '📦' },
  { to: '/admin/routes', label: 'Zones & Routes', icon: '🗺️' },
  { to: '/admin/rewards', label: 'Rewards', icon: '⭐' },
  { to: '/admin/approvals', label: 'Approvals & Complaints', icon: '✅' },
]

export default function Sidebar() {
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <span>♻️</span>
        <div>
          <p className="admin-sidebar-title">EcoCycle</p>
          <p className="admin-sidebar-subtitle">Admin Portal</p>
        </div>
      </div>

      <nav className="admin-nav">
        {menuItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `admin-nav-link${isActive ? ' admin-nav-link-active' : ''}`
            }
          >
            <span className="admin-nav-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
