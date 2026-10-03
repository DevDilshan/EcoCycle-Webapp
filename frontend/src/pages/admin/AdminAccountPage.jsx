import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Mail, UserRound } from 'lucide-react'
import PageShell from '../../components/admin/AdminPageShell'
import { AcAlert, AcCard, AcToast } from '../../components/admin/AcUi'
import { useAuth } from '../../context/AuthContext'
import { apiRequest } from '../../lib/api'
import { profileInitials, shortProfileName } from '../../lib/adminUi'

/**
 * The console's account screen, used by both /admin/account and
 * /collector/account. It reads the role from the session rather than assuming
 * one, so the two sides share it instead of keeping duplicate forms.
 *
 * pages/admin/AccountPage is the older, unstyled version still used by the
 * resident route, and is deliberately left alone.
 */
function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function AdminAccountPage() {
  const { user, role, updatePassword, sendPasswordResetEmail, signOut } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const [passwordForm, setPasswordForm] = useState({
    password: '',
    confirmPassword: '',
  })

  async function handlePasswordUpdate(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSuccess(null)

    const { password, confirmPassword } = passwordForm
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      setBusy(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setBusy(false)
      return
    }

    const { error: updateError } = await updatePassword(password)
    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess('Password updated successfully.')
      setPasswordForm({ password: '', confirmPassword: '' })
    }
    setBusy(false)
  }

  async function handlePasswordResetEmail() {
    if (!user?.email) return

    setBusy(true)
    setError(null)
    setSuccess(null)

    const { error: resetError } = await sendPasswordResetEmail(user.email)
    if (resetError) {
      setError(resetError.message)
    } else {
      setSuccess(`Password reset link sent to ${user.email}.`)
    }
    setBusy(false)
  }

  async function handleDeleteAccount() {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await apiRequest('/account', { method: 'DELETE' })
      await signOut()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const displayName = shortProfileName({
    email: user?.email,
    fullName: user?.user_metadata?.full_name,
  })

  return (
    <PageShell title="Account" description="Manage your profile and password">
      <AcAlert message={error} onClose={() => setError(null)} />

      <div className="ac-grid ac-g-1-1">
        <AcCard title="Profile" subtitle="Your signed-in account details">
          <div className="ac-account-head">
            <span className="ac-avatar ac-avatar-lg" aria-hidden="true">
              {profileInitials(displayName)}
            </span>
            <div>
              <strong>{displayName}</strong>
              <span className="ac-sub">{role ?? 'admin'}</span>
            </div>
          </div>

          <dl className="ac-kv">
            <dt><Mail size={14} strokeWidth={2} aria-hidden="true" /> Email</dt>
            <dd>{user?.email ?? '—'}</dd>
            <dt><UserRound size={14} strokeWidth={2} aria-hidden="true" /> Role</dt>
            <dd>{role ?? 'admin'}</dd>
            <dt><KeyRound size={14} strokeWidth={2} aria-hidden="true" /> Member since</dt>
            <dd>{formatDate(user?.created_at)}</dd>
          </dl>
        </AcCard>

        <AcCard title="Password" subtitle="Change your password or request a reset link">
          <form className="ac-form" onSubmit={handlePasswordUpdate}>
            <div className="ac-field">
              <label htmlFor="account-password">New password</label>
              <input
                id="account-password"
                type="password"
                value={passwordForm.password}
                onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            <div className="ac-field">
              <label htmlFor="account-confirm-password">Confirm new password</label>
              <input
                id="account-confirm-password"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            <div className="ac-actions">
              <button type="submit" className="ac-btn ac-btn-primary" disabled={busy}>
                Update password
              </button>
              <button
                type="button"
                className="ac-btn ac-btn-ghost"
                onClick={handlePasswordResetEmail}
                disabled={busy}
              >
                Email reset link
              </button>
            </div>
          </form>
        </AcCard>
      </div>

      <AcCard title="Delete account" subtitle="Permanently remove your account and data">
        <p style={{ marginTop: 0, color: '#8a1c12' }}>
          This permanently deletes your account and all associated data. This action cannot be undone.
        </p>
        {!confirmDelete ? (
          <div className="ac-actions">
            <button
              type="button"
              className="ac-btn"
              style={{ background: '#8a1c12', color: '#fff' }}
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
            >
              Delete account
            </button>
          </div>
        ) : (
          <div className="ac-form">
            <div className="ac-field">
              <label htmlFor="ac-confirm-delete">Type DELETE to confirm</label>
              <input
                id="ac-confirm-delete"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
              />
            </div>
            <div className="ac-actions">
              <button
                type="button"
                className="ac-btn"
                style={{ background: '#8a1c12', color: '#fff' }}
                onClick={handleDeleteAccount}
                disabled={busy || confirmText !== 'DELETE'}
              >
                {busy ? 'Deleting…' : 'Delete my account permanently'}
              </button>
              <button
                type="button"
                className="ac-btn ac-btn-ghost"
                onClick={() => { setConfirmDelete(false); setConfirmText('') }}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </AcCard>

      <AcToast message={success} onDone={() => setSuccess(null)} />
    </PageShell>
  )
}
