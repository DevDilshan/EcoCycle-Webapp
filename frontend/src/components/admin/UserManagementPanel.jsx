import { useCallback, useEffect, useMemo, useState } from 'react'
import { AcAlert, AcCard, AcChips, AcToast } from './AcUi'
import { useAdminCatalog } from '../../hooks/useAdminCatalog'
import { formatCompactDate, shortProfileName } from '../../lib/adminUi'
import { apiRequest } from '../../lib/api'

const ROLE_TABS = [
  { key: '', label: 'All' },
  { key: 'resident', label: 'Residents' },
  { key: 'collector', label: 'Collectors' },
  { key: 'admin', label: 'Admins' },
]

const ROLE_OPTIONS = [
  { value: 'resident', label: 'Resident' },
  { value: 'collector', label: 'Collector' },
  { value: 'admin', label: 'Admin' },
]

function displayRole(role) {
  if (!role || role === 'user') return 'resident'
  return String(role).toLowerCase()
}

function roleLabel(role) {
  const key = displayRole(role)
  return ROLE_OPTIONS.find((option) => option.value === key)?.label ?? key
}

export default function UserManagementPanel({ search = '' }) {
  const catalog = useAdminCatalog()
  const [roleFilter, setRoleFilter] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [pending, setPending] = useState({})
  const [draftRoles, setDraftRoles] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query = roleFilter ? `?role=${encodeURIComponent(roleFilter)}` : ''
      const data = await apiRequest(`/profiles${query}`)
      setItems(Array.isArray(data) ? data : [])
      setDraftRoles({})
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [roleFilter])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter((profile) => {
      const name = shortProfileName(profile).toLowerCase()
      const email = (profile.email || '').toLowerCase()
      return name.includes(term) || email.includes(term)
    })
  }, [items, search])

  async function saveRole(profile) {
    const nextRole = draftRoles[profile.id] ?? displayRole(profile.role)
    if (displayRole(profile.role) === nextRole) return

    setPending((state) => ({ ...state, [profile.id]: true }))
    setError(null)
    try {
      const updated = await apiRequest(`/profiles/${profile.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: nextRole }),
      })
      setItems((rows) => rows.map((row) => (row.id === profile.id ? updated : row)))
      setDraftRoles((state) => {
        const next = { ...state }
        delete next[profile.id]
        return next
      })
      setSuccess(`${shortProfileName(profile)} is now a ${roleLabel(nextRole).toLowerCase()}.`)
      catalog.refresh({ force: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setPending((state) => {
        const next = { ...state }
        delete next[profile.id]
        return next
      })
    }
  }

  return (
    <>
      <AcToast message={success} onClose={() => setSuccess(null)} />
      <AcAlert message={error} onClose={() => setError(null)} />

      <AcCard
        subtitle="Role changes apply on the user’s next sign-in."
        action={(
          <div className="ac-toolbar" style={{ margin: 0 }}>
            <AcChips
              options={ROLE_TABS}
              value={roleFilter}
              onChange={setRoleFilter}
              label="Filter by role"
            />
          </div>
        )}
      >
        {loading ? (
          <p className="ac-empty">Loading users…</p>
        ) : filtered.length === 0 ? (
          <p className="ac-empty">No users match this filter.</p>
        ) : (
          <div className="ac-table-wrap">
            <table className="ac-table ac-table-users">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th><span className="ac-sr-only">Save role</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((profile) => {
                  const current = displayRole(profile.role)
                  const draft = draftRoles[profile.id] ?? current
                  const dirty = draft !== current
                  const busy = Boolean(pending[profile.id])
                  return (
                    <tr key={profile.id} className="ac-table-static">
                      <td><strong>{shortProfileName(profile)}</strong></td>
                      <td>{profile.email}</td>
                      <td>
                        <div className="ac-field ac-field-inline">
                          <label className="ac-sr-only" htmlFor={`role-${profile.id}`}>Role</label>
                          <select
                            id={`role-${profile.id}`}
                            value={draft}
                            disabled={busy}
                            onChange={(event) => {
                              const value = event.target.value
                              setDraftRoles((state) => ({ ...state, [profile.id]: value }))
                            }}
                          >
                            {ROLE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td>{formatCompactDate(profile.createdAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="ac-btn ac-btn-ghost"
                          disabled={!dirty || busy}
                          onClick={() => saveRole(profile)}
                        >
                          {busy ? 'Saving…' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </AcCard>
    </>
  )
}
