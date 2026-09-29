import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import EcoLogo, { EcoMark } from '../components/public/EcoLogo'
import { useAuth } from '../context/AuthContext'
import { getUserRole } from '../lib/supabase'
import { getHomePath } from '../lib/roles'
import '../styles/public.css'

export default function LoginPage() {
  const { signIn, user, role } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  if (user) {
    return <Navigate to={getHomePath(role)} replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data, error: authError } = await signIn(email, password)
    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    const userRole = getUserRole(data.user, data.session)
    navigate(getHomePath(userRole))
  }

  return (
    <div className="eco eco-auth">
      <div className="eco-container eco-auth-top">
        <Link to="/" className="eco-brand">
          <EcoLogo />
        </Link>
        <Link className="eco-btn eco-btn-ghost" to="/">
          <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
          <span>Back to home</span>
        </Link>
      </div>

      <main className="eco-auth-main">
        <form className="eco-auth-card eco-enter" onSubmit={handleSubmit}>
          <span className="eco-auth-icon">
            <EcoMark size={22} />
          </span>
          <h1>Welcome back</h1>
          <p className="eco-auth-sub">Log in to manage your pickups and rewards.</p>

          <div className="eco-form">
            <div className="eco-field">
              <label className="eco-label" htmlFor="login-email">Email</label>
              <div className="eco-input-wrap">
                <Mail size={18} strokeWidth={2} aria-hidden="true" />
                <input
                  className="eco-input"
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="eco-field">
              <label className="eco-label" htmlFor="login-password">Password</label>
              <div className="eco-input-wrap">
                <Lock size={18} strokeWidth={2} aria-hidden="true" />
                <input
                  className="eco-input eco-input-has-toggle"
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  className="eco-input-toggle"
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword
                    ? <EyeOff size={18} strokeWidth={2} aria-hidden="true" />
                    : <Eye size={18} strokeWidth={2} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="eco-alert" role="alert">{error}</p>
            )}

            <button
              className="eco-btn eco-btn-primary eco-btn-block eco-btn-lg"
              type="submit"
              disabled={loading}
            >
              <span>{loading ? 'Logging in…' : 'Log in'}</span>
              <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          <p className="eco-auth-alt">
            <span>New to EcoCycle?</span> <Link to="/register">Create an account</Link>
          </p>
        </form>
      </main>
    </div>
  )
}
