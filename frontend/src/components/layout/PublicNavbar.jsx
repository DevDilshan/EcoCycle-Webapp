import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { ArrowUpRight, Menu, X } from 'lucide-react'
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
 * The landing stylesheet blends into the hero and uses a light surface after scrolling.
 * An intersection sentinel adds the sticky header's shadow without a scroll loop.
 */
export default function PublicNavbar() {
  const { user, role, signOut } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const sentinel = useRef(null)
  const toggle = useRef(null)
  const drawer = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const opener = toggle.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    drawer.current.showModal()
    const desktop = window.matchMedia('(min-width: 901px)')
    const closeOnDesktop = (event) => { if (event.matches) setMenuOpen(false) }
    desktop.addEventListener('change', closeOnDesktop)
    return () => {
      document.body.style.overflow = previousOverflow
      desktop.removeEventListener('change', closeOnDesktop)
      opener?.focus({ preventScroll: true })
    }
  }, [menuOpen])

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting))
    observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [])

  const dashboardLabel =
    role === 'admin' ? 'Admin' : role === 'collector' ? 'Collector' : 'Dashboard'

  return (
    <>
    <div ref={sentinel} className="eco-nav-sentinel" aria-hidden="true" />
    <header className={`eco-nav eco-nav-over${scrolled ? ' is-scrolled' : ''}`} onKeyDown={(event) => {
      if (event.key === 'Escape') { setMenuOpen(false); toggle.current?.focus() }
    }}>
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
          ref={toggle}
          type="button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="eco-mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen
            ? <X size={22} strokeWidth={2} aria-hidden="true" />
            : <Menu size={22} strokeWidth={2} aria-hidden="true" />}
        </button>
      </div>

    </header>
    {menuOpen && createPortal(
      <dialog ref={drawer} id="eco-mobile-navigation" className="eco eco-landing eco-nav-drawer"
        aria-labelledby="eco-drawer-title" onCancel={(event) => { event.preventDefault(); setMenuOpen(false) }}>
        <div className="eco-drawer-inner">
          <div className="eco-drawer-top">
            <a href="#top" className="eco-brand" onClick={() => setMenuOpen(false)}><EcoLogo /></a>
            <button type="button" className="eco-drawer-close" aria-label="Close menu" autoFocus onClick={() => setMenuOpen(false)}><X size={24} aria-hidden="true" /></button>
          </div>
          <h2 id="eco-drawer-title">Recycling starts here.</h2>
          <nav className="eco-drawer-links" aria-label="Mobile navigation">
        {NAV_LINKS.map((link) => (
          <a
            key={link.label}
            className="eco-drawer-link"
            href={link.href}
            onClick={() => setMenuOpen(false)}
          >
            {link.label}
            <ArrowUpRight size={22} aria-hidden="true" />
          </a>
        ))}
          </nav>
          <div className="eco-drawer-bottom">
            <p>A cleaner neighbourhood, one pickup at a time.</p>
            <div className="eco-drawer-actions">
        {user ? (
            <>
              <Link
                className="eco-btn eco-btn-secondary"
                to={getHomePath(role)}
                onClick={() => setMenuOpen(false)}
              >
                {dashboardLabel}
              </Link>
              <button className="eco-btn eco-btn-primary" type="button" onClick={() => { setMenuOpen(false); signOut() }}>
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
          </div>
        </div>
      </dialog>, document.body
    )}
    </>
  )
}
