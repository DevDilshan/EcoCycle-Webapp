import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  House,
  Lock,
  Mail,
  MailCheck,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import EcoLogo, { EcoMark } from '../components/public/EcoLogo'
import GoogleButton from '../components/public/GoogleButton'
import { useAuth } from '../context/AuthContext'
import { getHomePath } from '../lib/roles'
import '../styles/public.css'

const ROLES = [
  { value: 'resident', label: 'Resident', icon: House },
  { value: 'collector', label: 'Collector', icon: Truck },
  { value: 'admin', label: 'Admin', icon: ShieldCheck },
]

export default function RegisterPage() {
  const { signUp, user, role } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [selectedRole, setSelectedRole] = useState('resident')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  if (user) {
    return <Navigate to={getHomePath(role)} replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } = await signUp(email, password, selectedRole)
    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    setSuccess(true)
  }

  const header = (
    <div className="eco-container eco-auth-top">
      <Link to="/" className="eco-brand">
        <EcoLogo />
      </Link>
      <Link className="eco-btn eco-btn-ghost" to="/">
        <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
        <span>Back to home</span>
      </Link>
    </div>
  )

  if (success) {
    return (
      <div className="eco eco-auth">
        {header}
        <main className="eco-auth-main">
          <div className="eco-auth-card eco-enter">
            <span className="eco-auth-icon">
              <MailCheck size={22} strokeWidth={2} aria-hidden="true" />
            </span>
            <h1>Check your email</h1>
            <p className="eco-auth-sub">
              We sent a confirmation link to <strong>{email}</strong>. Open it to activate
              your account.
            </p>
            <div className="eco-form">
              <Link className="eco-btn eco-btn-primary eco-btn-block eco-btn-lg" to="/login">
                <span>Go to log in</span>
                <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="eco eco-auth">
      {header}

      <main className="eco-auth-main">
        <form className="eco-auth-card eco-enter" onSubmit={handleSubmit}>
          <span className="eco-auth-icon">
            <EcoMark size={22} />
          </span>
          <h1>Create your account</h1>
          <p className="eco-auth-sub">Join EcoCycle and start recycling smarter.</p>

          <div className="eco-form">
            <div className="eco-field">
              <label className="eco-label" htmlFor="reg-email">Email</label>
              <div className="eco-input-wrap">
                <Mail size={18} strokeWidth={2} aria-hidden="true" />
                <input
                  className="eco-input"
                  id="reg-email"
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
              <label className="eco-label" htmlFor="reg-password">Password</label>
              <div className="eco-input-wrap">
                <Lock size={18} strokeWidth={2} aria-hidden="true" />
                <input
                  className="eco-input eco-input-has-toggle"
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  minLength={6}
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
              <p className="eco-hint">Use 6 or more characters.</p>
            </div>

            <fieldset className="eco-field" style={{ border: 0, margin: 0, padding: 0 }}>
              <legend className="eco-label" style={{ padding: 0, marginBottom: '8px' }}>
                I am a…
              </legend>
              <div className="eco-roles">
                {ROLES.map(({ value, label, icon: Icon }) => (
                  <label
                    key={value}
                    className={`eco-role${selectedRole === value ? ' is-active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={value}
                      checked={selectedRole === value}
                      onChange={(e) => setSelectedRole(e.target.value)}
                    />
                    <Icon size={20} strokeWidth={2} aria-hidden="true" />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {error && (
              <p className="eco-alert" role="alert">{error}</p>
            )}

            <button
              className="eco-btn eco-btn-primary eco-btn-block eco-btn-lg"
              type="submit"
              disabled={loading}
            >
              <span>{loading ? 'Creating account…' : 'Create account'}</span>
              <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
            </button>

            <GoogleButton onError={setError} />
            <p className="eco-hint">Signing up with Google creates a resident account.</p>
          </div>

          <p className="eco-auth-alt">
            <span>Already have an account?</span> <Link to="/login">Log in</Link>
          </p>
        </form>
      </main>
    </div>
  )
}
