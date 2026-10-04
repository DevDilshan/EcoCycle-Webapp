import { NavLink } from 'react-router-dom'
import { House, LogOut, Map as MapIcon, Route } from 'lucide-react'
import { EcoMark } from '../public/EcoLogo'
import { useAuth } from '../../context/AuthContext'
import { useCollectorData } from '../collector/collectorShell'
import { profileInitials } from '../../lib/adminUi'
import { firstName, joinNames } from '../../lib/collectorUi'

export default function CollectorSidebar({ isOpen = false, onNavigate }) {
  const { user, role, signOut } = useAuth()
  const { counts, zoneNames } = useCollectorData()

  const name = user?.user_metadata?.full_name?.trim() || firstName(user)
  const zones = joinNames(zoneNames)

  return (
    <aside
      className={`ac-side${isOpen ? ' is-open' : ''}`}
      id="collector-nav"
      aria-label="Collector navigation"
    >
      <NavLink to="/collector" end className="ac-brand" onClick={onNavigate}>
        <span className="ac-brand-mark"><EcoMark size={20} /></span>
        <span>EcoCycle<small>Collector</small></span>
      </NavLink>

      <p className="ac-nav-label">Today</p>
      <nav className="ac-nav">
        <NavLink
          to="/collector"
          end
          onClick={onNavigate}
          className={({ isActive }) => `ac-nav-link${isActive ? ' is-active' : ''}`}
        >
          <House size={18} strokeWidth={2} aria-hidden="true" />
          <span>Overview</span>
        </NavLink>
        <NavLink
          to="/collector/route"
          onClick={onNavigate}
          className={({ isActive }) => `ac-nav-link${isActive ? ' is-active' : ''}`}
        >
          <Route size={18} strokeWidth={2} aria-hidden="true" />
          <span>Today&rsquo;s route</span>
          {counts.pending > 0 && <span className="ac-count">{counts.pending}</span>}
        </NavLink>
        <NavLink
          to="/collector/map"
          onClick={onNavigate}
          className={({ isActive }) => `ac-nav-link${isActive ? ' is-active' : ''}`}
        >
          <MapIcon size={18} strokeWidth={2} aria-hidden="true" />
          <span>Route map</span>
        </NavLink>
      </nav>

      <div className="ac-side-foot">
        <div className="c-shift">
          <strong><span className="ac-dot-live" aria-hidden="true" /> On shift</strong>
          <p>
            {counts.total === 0
              ? 'No stops scheduled today.'
              : `${counts.total} stop${counts.total === 1 ? '' : 's'} today${zones ? ` in ${zones}` : ''}.`}
          </p>
        </div>
        <div className="ac-me-row">
          <NavLink to="/collector/account" className="ac-me" onClick={onNavigate}>
            <span className="ac-avatar" aria-hidden="true">{profileInitials(name)}</span>
            <span>{name}<small>{role ?? 'collector'}</small></span>
          </NavLink>
          <button type="button" className="ac-logout" onClick={signOut} aria-label="Log out">
            <LogOut size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  )
}
