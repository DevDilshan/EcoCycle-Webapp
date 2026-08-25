import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RegisterPage() {
  const { signUp, user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('user')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } = await signUp(email, password, role)
    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    setSuccess(true)
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Check your email</h1>
          <p className="auth-subtitle">
            We sent a confirmation link to <strong>{email}</strong>.
          </p>
          <Link to="/login" className="btn-primary">Go to login</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Create account</h1>
        <p className="auth-subtitle">Choose your account type</p>

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />

        <label htmlFor="role">Role</label>
        <select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="user">User</option>
          <option value="resident">Resident</option>
          <option value="collector">Collector</option>
          <option value="admin">Admin</option>
        </select>

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Creating account...' : 'Register'}
        </button>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  )
}
