import { useState } from 'react'
import PageShell from '../../components/PageShell'
import AdminAlert from '../../components/admin/AdminAlert'
import AdminCard from '../../components/admin/AdminCard'
import { useAuth } from '../../context/AuthContext'

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function AccountPage({ eyebrow = null }) {
  const { user, role, updatePassword, sendPasswordResetEmail } = useAuth()
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [busy, setBusy] = useState(false)

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

  return (
    <PageShell
      eyebrow={eyebrow}
      title="Account settings"
      description="Manage your profile and password."
    >
      <AdminAlert type="error" message={error} onClose={() => setError(null)} />
      <AdminAlert type="success" message={success} onClose={() => setSuccess(null)} />

      <div className="admin-account-grid">
        <AdminCard title="Profile" subtitle="Your signed-in account details">
          <dl className="admin-account-details">
            <div>
              <dt>Email</dt>
              <dd>{user?.email ?? '—'}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd className="admin-account-role">{role ?? 'resident'}</dd>
            </div>
            <div>
              <dt>Member since</dt>
              <dd>{formatDate(user?.created_at)}</dd>
            </div>
          </dl>
        </AdminCard>

        <AdminCard title="Password" subtitle="Change your password or request a reset link">
          <form className="admin-form" onSubmit={handlePasswordUpdate}>
            <div>
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
            <div>
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
            <div className="admin-actions">
              <button type="submit" className="btn-primary" disabled={busy}>
                Update password
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handlePasswordResetEmail}
                disabled={busy}
              >
                Email reset link
              </button>
            </div>
          </form>
        </AdminCard>
      </div>
    </PageShell>
  )
}
