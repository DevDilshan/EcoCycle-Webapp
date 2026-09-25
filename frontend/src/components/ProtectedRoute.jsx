import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getHomePath } from '../lib/roles'

const ROLE_LABELS = {
  admin: 'admin',
  collector: 'collector',
}

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, role, loading } = useAuth()

  if (loading) {
    return <p className="auth-loading">Loading...</p>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && role !== requiredRole) {
    const label = ROLE_LABELS[requiredRole] ?? requiredRole
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Access denied</h1>
          <p className="auth-subtitle">
            Your account does not have {label} access. Ask a team member to set{' '}
            <code>app_metadata.role</code> to <code>{label}</code> in Supabase.
          </p>
          <a href={getHomePath(role)} className="btn-primary">Go to your dashboard</a>
        </div>
      </div>
    )
  }

  return children
}