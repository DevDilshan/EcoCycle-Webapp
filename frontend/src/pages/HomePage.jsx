import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function HomePage() {
  const { user, role } = useAuth()

  return (
    <div className="page">
      <header className="page-header">
        <div className="brand">♻️ EcoCycle</div>
        <nav className="nav">
          {user ? (
            <>
              {role === 'admin' ? (
                <Link to="/admin">Admin</Link>
              ) : (
                <Link to="/dashboard">Dashboard</Link>
              )}
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register" className="btn-primary">Register</Link>
            </>
          )}
        </nav>
      </header>

      <main className="hero">
        <h1>Smart Waste &amp; Recycling Pickup</h1>
        <p>Schedule pickups, track recycling, and manage waste collection.</p>
      </main>
    </div>
  )
}
