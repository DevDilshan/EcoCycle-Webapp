import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function UserDashboardPage() {
  const { user, role, signOut } = useAuth()

  return (
    <div className="page">
      <header className="page-header">
        <div className="brand">♻️ EcoCycle</div>
        <nav className="nav">
          <span className="user-email">{user?.email}</span>
          <button type="button" onClick={signOut} className="btn-secondary">Logout</button>
        </nav>
      </header>

      <main className="dashboard">
        <h1>Dashboard</h1>
        <p>Signed in as <strong>{user?.email}</strong> ({role})</p>
        <Link to="/">← Back to home</Link>
      </main>
    </div>
  )
}
