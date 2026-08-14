import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AdminPage() {
  const { user, signOut } = useAuth()

  return (
    <div className="page">
      <header className="page-header">
        <div className="brand">♻️ EcoCycle Admin</div>
        <nav className="nav">
          <span className="user-email">{user?.email}</span>
          <button type="button" onClick={signOut} className="btn-secondary">Logout</button>
        </nav>
      </header>

      <main className="dashboard">
        <h1>Admin Dashboard</h1>
        <p>Welcome, {user?.email}. You have admin access.</p>
        <Link to="/">← Back to home</Link>
      </main>
    </div>
  )
}
