import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function TopBar() {
  const { user, signOut } = useAuth()

  return (
    <header className="admin-topbar">
      <Link to="/" className="admin-topbar-home">← Home</Link>
      <div className="admin-topbar-actions">
        <span className="user-email">{user?.email}</span>
        <button type="button" onClick={signOut} className="btn-secondary">
          Logout
        </button>
      </div>
    </header>
  )
}
