import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  ChartColumn,
  ChevronDown,
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
import { APPROVALS_UPDATED_EVENT } from '../../lib/approvalEvents'
import { apiRequest } from '../../lib/api'
import { profileInitials, shortProfileName } from '../../lib/adminUi'
import { pagedTotalCount } from '../../lib/paging'

const menuItems = [
  { to: '/admin', label: 'Dashboard', Icon: LayoutDashboard, end: true },
  { to: '/admin/pickup-requests', label: 'Requests', Icon: Inbox },
  { to: '/admin/approvals', label: 'Approvals', Icon: ShieldCheck, badge: true },
  { to: '/admin/routes', label: 'Zones & Routes', Icon: Map },
  {
    to: '/admin/rewards',
    label: 'Rewards',
    Icon: Trophy,
    children: [
      { to: '/admin/rewards', label: 'Overview', end: true },
      { to: '/admin/rewards/catalog', label: 'Reward items' },
      { to: '/admin/rewards/requests', label: 'Redemptions', badge: 'redemptions' },
      { to: '/admin/rewards/history', label: 'Points history' },
      { to: '/admin/rewards/award', label: 'Give points' },
      { to: '/admin/rewards/check', label: 'Check a pickup' },
    ],
  },
  { to: '/admin/complaints', label: 'Complaints', Icon: MessageSquare },
  { to: '/admin/compliance', label: 'Compliance', Icon: ChartColumn },
]

export default function Sidebar({ isOpen = false, onNavigate, readOnly = false }) {
  const { user, session, signOut } = useAuth()
  const [approvalCount, setApprovalCount] = useState(0)
  const [redemptionCount, setRedemptionCount] = useState(0)
  const { pathname } = useLocation()
  // Which dropdown sections the admin has opened or closed by hand. A section
  // the admin has not touched is open exactly when they are inside it.
  const [toggled, setToggled] = useState({})

  useEffect(() => {
    if (!session?.access_token) return undefined

    let cancelled = false

    async function refreshCount(retry = 0) {
      try {
        const page = await apiRequest('/approvals?status=Pending&pageSize=1')
        if (!cancelled) setApprovalCount(pagedTotalCount(page))
      } catch {
        if (!cancelled && retry < 2) {
          window.setTimeout(() => refreshCount(retry + 1), 350 * (retry + 1))
        }
      }
    }

    function onUpdated(event) {
      const pending = event?.detail?.pendingCount
      if (typeof pending === 'number') setApprovalCount(pending)
      refreshCount()
    }

    refreshCount()
    window.addEventListener(APPROVALS_UPDATED_EVENT, onUpdated)
    return () => {
      cancelled = true
      window.removeEventListener(APPROVALS_UPDATED_EVENT, onUpdated)
    }
  }, [session?.access_token])

  useEffect(() => {
    // Pending redemption requests, refreshed whenever an admin decides one.
    function refreshRedemptions() {
      apiRequest('/redemptions?status=Pending&pageSize=1')
        .then((page) => setRedemptionCount(pagedTotalCount(page)))
        .catch(() => setRedemptionCount(0))
    }
    refreshRedemptions()
    window.addEventListener('ecocycle-redemptions-updated', refreshRedemptions)
    return () => window.removeEventListener('ecocycle-redemptions-updated', refreshRedemptions)
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
        {menuItems.map(({ to, label, Icon, end, badge, children }) => {
          if (!children) {
            return (
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
            )
          }

          // A dropdown section: the row only opens and closes its links.
          const inside = pathname.startsWith(to)
          const exact = pathname === to
          // The overview keeps the links closed until the arrow is used; on any
          // page below it the links show, so you can see where you are.
          const open = toggled[to] ?? (inside && !exact)
          const panelId = `nav-section-${label.toLowerCase()}`
          // Highlight the row on its own page, or when the links are hidden but you are inside.
          const rowState = exact || (inside && !open) ? 'is-active' : inside ? 'is-parent-open' : ''
          const pending = children.reduce((sum, child) => sum + (child.badge === 'redemptions' ? redemptionCount : 0), 0)

          return (
            <div key={to} className="ac-nav-group">
              <div className={`ac-nav-row${rowState ? ` ${rowState}` : ''}`}>
                <NavLink
                  to={to}
                  end
                  className="ac-nav-main"
                  onClick={onNavigate}
                >
                  <Icon size={18} strokeWidth={2} aria-hidden="true" />
                  <span>{label}</span>
                  {!open && pending > 0 && <span className="ac-count">{pending}</span>}
                </NavLink>
                <button
                  type="button"
                  className="ac-nav-chevron-btn"
                  aria-expanded={open}
                  aria-controls={panelId}
                  aria-label={`${open ? 'Hide' : 'Show'} ${label} links`}
                  onClick={() => setToggled({ ...toggled, [to]: !open })}
                >
                  <ChevronDown size={16} strokeWidth={2.4} className={`ac-nav-chevron${open ? ' is-open' : ''}`} aria-hidden="true" />
                </button>
              </div>
              <div className={`ac-nav-collapse${open ? ' is-open' : ''}`} id={panelId}>
                <div className="ac-nav-sub">
                  {children.map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      end={child.end}
                      onClick={onNavigate}
                      tabIndex={open ? 0 : -1}
                      className={({ isActive }) => `ac-nav-sublink${isActive ? ' is-active' : ''}`}
                    >
                      <span>{child.label}</span>
                      {child.badge === 'redemptions' && redemptionCount > 0 && (
                        <span className="ac-count">{redemptionCount}</span>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </nav>

      <div className="ac-side-foot">
        <div className="ac-agent-card">
          <strong><span className="ac-dot-live" aria-hidden="true" /> Agents running</strong>
          <p>
            Classifier labels waste; Policy validator checks rules; Router assigns collectors;
            Notifier drafts review text when a pickup is flagged.
          </p>
        </div>
        <div className="ac-me-row">
          <NavLink to="/admin/account" className="ac-me" onClick={onNavigate}>
            <span className="ac-avatar" aria-hidden="true">{profileInitials(displayName)}</span>
            <span>{displayName}<small>Municipal Admin</small></span>
          </NavLink>
          <button type="button" className="ac-logout" onClick={signOut} disabled={readOnly} aria-label="Log out">
            <LogOut size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  )
}
