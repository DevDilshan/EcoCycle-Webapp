import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Lock } from 'lucide-react'
import EcoLogo, { EcoMark } from '../components/public/EcoLogo'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import '../styles/public.css'

const MIN_PASSWORD_LENGTH = 8

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false) // a recovery session is present

  useEffect(() => {
    // supabase-js parses the recovery token from the URL on load and emits a
    // PASSWORD_RECOVERY event once the temporary session is ready. Until then
    // updateUser would fail, so the form stays gated behind `ready`.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    const { error: updateError } = await updatePassword(password)
    setLoading(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setDone(true)
    // End the temporary recovery session, otherwise the user counts as signed
    // in and /login would bounce them straight to the dashboard. They should
    // log in again with the new password.
    await supabase.auth.signOut()
    setTimeout(() => navigate('/login'), 2500)
  }

  return (
    <div className="eco eco-auth">
      <div className="eco-container eco-auth-top">
        <Link to="/" className="eco-brand">
          <EcoLogo />
        </Link>
      </div>

      <main className="eco-auth-main">
        <form className="eco-auth-card eco-enter" onSubmit={handleSubmit}>
          <span className="eco-auth-icon">
            <EcoMark size={22} />
          </span>
          <h1>Set a new password</h1>

          {done ? (
            <p className="eco-auth-sub" role="status">
              Password updated. Redirecting you to login…
            </p>
          ) : !ready ? (
            <div className="eco-form">
              <p className="eco-auth-sub">
                This page opens from the reset link in your email. If you arrived here directly,
                or the link has expired, request a new one.
              </p>
              <Link
                className="eco-btn eco-btn-primary eco-btn-block eco-btn-lg"
                to="/forgot-password"
              >
                <span>Request a reset link</span>
              </Link>
            </div>
          ) : (
            <div className="eco-form">
              <p className="eco-auth-sub">Choose a new password for your account.</p>

              <div className="eco-field">
                <label className="eco-label" htmlFor="new-password">New password</label>
                <div className="eco-input-wrap">
                  <Lock size={18} strokeWidth={2} aria-hidden="true" />
                  <input
                    className="eco-input eco-input-has-toggle"
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                    autoComplete="new-password"
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

              <div className="eco-field">
                <label className="eco-label" htmlFor="confirm-password">Confirm password</label>
                <div className="eco-input-wrap">
                  <Lock size={18} strokeWidth={2} aria-hidden="true" />
                  <input
                    className="eco-input eco-input-has-toggle"
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter your new password"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    className="eco-input-toggle"
                    type="button"
                    onClick={() => setShowConfirm((shown) => !shown)}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    aria-pressed={showConfirm}
                  >
                    {showConfirm
                      ? <EyeOff size={18} strokeWidth={2} aria-hidden="true" />
                      : <Eye size={18} strokeWidth={2} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {error && <p className="eco-alert" role="alert">{error}</p>}

              <button
                className="eco-btn eco-btn-primary eco-btn-block eco-btn-lg"
                type="submit"
                disabled={loading}
              >
                <span>{loading ? 'Updating…' : 'Update password'}</span>
                <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          )}
        </form>
      </main>
    </div>
  )
}
