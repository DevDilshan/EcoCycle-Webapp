import { Link, NavLink } from 'react-router-dom'
import { LayoutGrid, LogOut, MessageSquare, Package, Trophy } from 'lucide-react'
import { EcoMark } from '../public/EcoLogo'
import { useAuth } from '../../context/AuthContext'
import { profileInitials, shortProfileName } from '../../lib/adminUi'

// Lucide icons rather than emoji. The emoji rendered differently on every
// platform and sat at a different weight from the rest of the console.
const MENU = [
  { to: '/dashboard', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/dashboard/pickups', label: 'My pickups', icon: Package },
  { to: '/dashboard/rewards', label: 'Rewards', icon: Trophy },
  { to: '/dashboard/complaints', label: 'Complaints', icon: MessageSquare },
]

export default function ResidentSidebar({ isOpen = false, onNavigate }) {
  const { user, role, signOut } = useAuth()

  const displayName = shortProfileName({
    email: user?.email,
    fullName: user?.user_metadata?.full_name,
  })

  return (
    <aside
      className={`ac-side${isOpen ? ' is-open' : ''}`}
      id="resident-nav"
      aria-label="Resident navigation"
    >
      <NavLink to="/dashboard" end className="ac-brand" onClick={onNavigate}>
        <span className="ac-brand-mark"><EcoMark size={20} /></span>
        <span>EcoCycle<small>Resident</small></span>
      </NavLink>

      <p className="ac-nav-label">Main</p>
      <nav className="ac-nav">
        {MENU.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) => `ac-nav-link${isActive ? ' is-active' : ''}`}
          >
            <Icon size={18} strokeWidth={2} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="ac-side-foot">
        <div className="ac-me-row">
          <NavLink to="/dashboard/account" className="ac-me" onClick={onNavigate}>
            <span className="ac-avatar" aria-hidden="true">{profileInitials(displayName)}</span>
            <span>{displayName}<small>{role ?? 'resident'}</small></span>
          </NavLink>
          <button type="button" className="ac-logout" onClick={signOut} aria-label="Log out">
            <LogOut size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <Link to="/" className="r-side-link" onClick={onNavigate}>Back to site</Link>
      </div>
    </aside>
  )
}
