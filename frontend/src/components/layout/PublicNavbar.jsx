import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const publicLinks = [
  { label: 'Home', to: '/' },
  { label: 'Features', to: '/#features' },
  { label: 'How It Works', to: '/#how-it-works' },
]

export default function PublicNavbar() {
  const { user, role, signOut } = useAuth()

  return (
    <header className="public-header">
      <div className="public-header-inner">
        <Link to="/" className="brand">♻️ EcoCycle</Link>

        <nav className="public-nav">
          {publicLinks.map((link) => (
            <a key={link.label} href={link.to} className="public-nav-link">
              {link.label}
            </a>
          ))}

          {user ? (
            <>
              {role === 'admin' ? (
                <Link to="/admin" className="public-nav-link">Admin</Link>
              ) : (
                <Link to="/dashboard" className="public-nav-link">Dashboard</Link>
              )}
              <button type="button" onClick={signOut} className="btn-secondary">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="public-nav-link">Login</Link>
              <Link to="/register" className="btn-primary public-nav-btn">Register</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
