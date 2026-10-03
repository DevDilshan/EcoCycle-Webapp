import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react'
import EcoLogo, { EcoMark } from '../components/public/EcoLogo'
import { useAuth } from '../context/AuthContext'
import '../styles/public.css'

export default function ForgotPasswordPage() {
  const { sendPasswordResetEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: resetError } = await sendPasswordResetEmail(email.trim())
    setLoading(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setSent(true)
  }

  return (
    <div className="eco eco-auth">
      <div className="eco-container eco-auth-top">
        <Link to="/" className="eco-brand">
          <EcoLogo />
        </Link>
        <Link className="eco-btn eco-btn-ghost" to="/login">
          <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
          <span>Back to login</span>
        </Link>
      </div>

      <main className="eco-auth-main">
        <form className="eco-auth-card eco-enter" onSubmit={handleSubmit}>
          <span className="eco-auth-icon">
            <EcoMark size={22} />
          </span>
          <h1>Reset your password</h1>
          <p className="eco-auth-sub">
            Enter your email and we&apos;ll send you a link to set a new password.
          </p>

          {sent ? (
            <div className="eco-form">
              <p
                className="eco-alert"
                role="status"
                style={{ background: '#e8f5e9', color: '#1b5e20' }}
              >
                If an account exists for {email}, a reset link is on its way. Check your inbox
                (and your spam folder), then follow the link to choose a new password.
              </p>
              <Link className="eco-btn eco-btn-primary eco-btn-block eco-btn-lg" to="/login">
                <span>Back to login</span>
              </Link>
            </div>
          ) : (
            <div className="eco-form">
              <div className="eco-field">
                <label className="eco-label" htmlFor="forgot-email">Email</label>
                <div className="eco-input-wrap">
                  <Mail size={18} strokeWidth={2} aria-hidden="true" />
                  <input
                    className="eco-input"
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              {error && <p className="eco-alert" role="alert">{error}</p>}

              <button
                className="eco-btn eco-btn-primary eco-btn-block eco-btn-lg"
                type="submit"
                disabled={loading}
              >
                <span>{loading ? 'Sending…' : 'Send reset link'}</span>
                <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          )}

          <p className="eco-auth-alt">
            <span>Remembered it?</span> <Link to="/login">Back to login</Link>
          </p>
        </form>
      </main>
    </div>
  )
}
