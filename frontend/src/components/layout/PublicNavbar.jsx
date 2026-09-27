import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import EcoLogo from '../public/EcoLogo'
import { useAuth } from '../../context/AuthContext'
import { getHomePath } from '../../lib/roles'

const NAV_LINKS = [
  { label: 'How it works', href: '#how' },
  { label: 'Features', href: '#features' },
  { label: 'Where we collect', href: '#service-areas' },
  { label: 'Contact', href: '#footer' },
]

/**
 * Public site navigation.
 *
 * Starts transparent with light text over the photo hero, then turns solid ivory
 * once the page scrolls (`.eco-nav-over` vs `.eco-nav-solid` in the design).
 */
export default function PublicNavbar() {
  const { user, role, signOut } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const dashboardLabel =
    role === 'admin' ? 'Admin' : role === 'collector' ? 'Collector' : 'Dashboard'

  return (
    <header className={`eco-nav eco-nav-over${scrolled ? ' is-scrolled' : ''}`}>
      <div className="eco-container eco-nav-inner">
        <a href="#top" className="eco-brand" onClick={() => setMenuOpen(false)}>
          <EcoLogo />
        </a>

        <nav className="eco-nav-links" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a key={link.label} className="eco-nav-link" href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="eco-nav-actions">
          {user ? (
            <>
              <Link className="eco-btn eco-btn-ghost" to={getHomePath(role)}>
                {dashboardLabel}
              </Link>
              <button className="eco-btn eco-btn-primary" type="button" onClick={signOut}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link className="eco-btn eco-btn-ghost" to="/login">Log in</Link>
              <Link className="eco-btn eco-btn-primary" to="/register">Register</Link>
            </>
          )}
        </div>

        <button
          className="eco-nav-toggle"
          type="button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen
            ? <X size={22} strokeWidth={2} aria-hidden="true" />
            : <Menu size={22} strokeWidth={2} aria-hidden="true" />}
        </button>
      </div>

      <div className={`eco-mobile-menu${menuOpen ? ' is-open' : ''}`}>
        {NAV_LINKS.map((link) => (
          <a
            key={link.label}
            className="eco-nav-link"
            href={link.href}
            onClick={() => setMenuOpen(false)}
          >
            {link.label}
          </a>
        ))}

        {user ? (
            <>
              <Link
                className="eco-btn eco-btn-secondary"
                to={getHomePath(role)}
                onClick={() => setMenuOpen(false)}
              >
                {dashboardLabel}
              </Link>
              <button className="eco-btn eco-btn-primary" type="button" onClick={signOut}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                className="eco-btn eco-btn-secondary"
                to="/login"
                onClick={() => setMenuOpen(false)}
              >
                Log in
              </Link>
              <Link
                className="eco-btn eco-btn-primary"
                to="/register"
                onClick={() => setMenuOpen(false)}
              >
                Register
              </Link>
            </>
        )}
      </div>
    </header>
  )
}
