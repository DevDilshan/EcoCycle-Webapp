import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, role, loading } = useAuth()

  if (loading) {
    return <p className="auth-loading">Loading...</p>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole === 'admin' && role !== 'admin') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Access denied</h1>
          <p className="auth-subtitle">
            Your account does not have admin access. Ask a team member to set{' '}
            <code>app_metadata.role</code> to <code>admin</code> in Supabase.
          </p>
          <a href="/dashboard" className="btn-primary">Go to Dashboard</a>
        </div>
      </div>
    )
  }

  return children
}
