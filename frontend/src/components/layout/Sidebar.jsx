import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  ChartColumn,
  Inbox,
  LayoutDashboard,
  LogOut,
  Map,
  MessageSquare,
  ShieldCheck,
  Trophy,
} from 'lucide-react'
import { EcoMark } from '../public/EcoLogo'
import { useAuth } from '../../context/AuthContext'
import { apiRequest } from '../../lib/api'
import { profileInitials, shortProfileName } from '../../lib/adminUi'

const menuItems = [
  { to: '/admin', label: 'Dashboard', Icon: LayoutDashboard, end: true },
  { to: '/admin/pickup-requests', label: 'Requests', Icon: Inbox },
  { to: '/admin/approvals', label: 'Approvals', Icon: ShieldCheck, badge: true },
  { to: '/admin/routes', label: 'Zones & Routes', Icon: Map },
  { to: '/admin/rewards', label: 'Rewards', Icon: Trophy },
  { to: '/admin/complaints', label: 'Complaints', Icon: MessageSquare },
  { to: '/admin/compliance', label: 'Compliance', Icon: ChartColumn },
]

export default function Sidebar({ isOpen = false, onNavigate }) {
  const { user, signOut } = useAuth()
  const [approvalCount, setApprovalCount] = useState(0)

  useEffect(() => {
    // The pending queue lives in the database, not in this browser: reading it
    // from localStorage showed 0 on any machine that had not raised the flag
    // itself. A failure leaves the badge hidden rather than showing a wrong one.
    function refreshCount() {
      apiRequest('/approvals?status=Pending&pageSize=1')
        .then((page) => setApprovalCount(page?.totalCount ?? 0))
        .catch(() => setApprovalCount(0))
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
    <aside
      className={`ac-side${isOpen ? ' is-open' : ''}`}
      id="admin-nav"
      aria-label="Admin navigation"
    >
      <NavLink to="/admin" end className="ac-brand" onClick={onNavigate}>
        <span className="ac-brand-mark"><EcoMark size={20} /></span>
        <span>EcoCycle<small>Admin console</small></span>
      </NavLink>

      <p className="ac-nav-label">Operations</p>
      <nav className="ac-nav">
        {menuItems.map(({ to, label, Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) => `ac-nav-link${isActive ? ' is-active' : ''}`}
          >
            <Icon size={18} strokeWidth={2} aria-hidden="true" />
            <span>{label}</span>
            {badge && approvalCount > 0 && <span className="ac-count">{approvalCount}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="ac-side-foot">
        <div className="ac-agent-card">
          <strong><span className="ac-dot-live" aria-hidden="true" /> Agents running</strong>
          <p>Classifier, Router, Validator and Notifier handle every request.</p>
        </div>
        <div className="ac-me-row">
          <NavLink to="/admin/account" className="ac-me" onClick={onNavigate}>
            <span className="ac-avatar" aria-hidden="true">{profileInitials(displayName)}</span>
            <span>{displayName}<small>Municipal Admin</small></span>
          </NavLink>
          <button type="button" className="ac-logout" onClick={signOut} aria-label="Log out">
            <LogOut size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  )
}
