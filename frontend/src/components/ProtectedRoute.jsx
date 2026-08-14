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
    return <Navigate to="/dashboard" replace />
  }

  return children
}
