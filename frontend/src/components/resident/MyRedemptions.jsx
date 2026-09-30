import { useCallback, useEffect, useState } from 'react'
import AdminCard from '../admin/AdminCard'
import FormModal from '../FormModal'
import { useConfirm } from '../../hooks/useConfirm'
import { apiRequest, formatDate } from '../../lib/api'

/**
 * The resident's redemption requests. They pick an item from the catalog in a
 * pop-up; a Pending request can be switched to another item (also a pop-up) or
 * cancelled after a confirmation. Points only leave the balance once an admin
 * approves.
 */
export default function MyRedemptions({ canRequest, balance, showForm, onCloseForm, onError, onSuccess, onChanged }) {
  const [items, setItems] = useState([])
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [chosen, setChosen] = useState('')
  const [editing, setEditing] = useState(null) // { id, rewardItemId }
  const [fieldError, setFieldError] = useState(null)
  const [confirmDialog, confirm] = useConfirm()

  const load = useCallback(async () => {
    try {
      const [requests, rewardItems] = await Promise.all([
        apiRequest('/redemptions?pageSize=50'),
        apiRequest('/reward-items?pageSize=100'),
      ])
      setItems(requests.items)
      setCatalog(rewardItems.items)
    } catch (err) {
      onError?.(err.message)
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => { load() }, [load])

  const reserved = items.filter((r) => r.status === 'Pending').reduce((sum, r) => sum + r.points, 0)
  const available = (balance ?? 0) - reserved

  function closeCreate() {
    setChosen('')
    setFieldError(null)
    onCloseForm?.()
  }

  const closeEdit = useCallback(() => {
    setEditing(null)
    setFieldError(null)
  }, [])

  async function run(action, successMessage) {
    setBusy(true)
    try {
      await action()
      onSuccess?.(successMessage)
      await load()
      onChanged?.()
      return true
    } catch (err) {
      onError?.(err.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!chosen) {
      setFieldError('Choose a reward to request.')
      return
    }
    const ok = await run(
      () => apiRequest('/redemptions', { method: 'POST', body: JSON.stringify({ rewardItemId: chosen }) }),
      'Redemption requested. An admin will review it.',
    )
    if (ok) closeCreate()
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!editing.rewardItemId) {
      setFieldError('Choose a reward.')
      return
    }
    const ok = await run(
      () => apiRequest(`/redemptions/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({ rewardItemId: editing.rewardItemId }),
      }),
      'Request updated.',
    )
    if (ok) closeEdit()
  }

  async function handleCancel(item) {
    const ok = await confirm({
      title: 'Cancel this request?',
      message: `Your request for ${item.reason} (${item.points} points) will be removed and the points become available again.`,
      confirmLabel: 'Cancel request',
      cancelLabel: 'Keep it',
      danger: true,
    })
    if (!ok) return
    run(() => apiRequest(`/redemptions/${item.id}`, { method: 'DELETE' }), 'Request cancelled.')
  }

  // What the resident can still pick: not sold out and within their free points.
  function rewardSelect(id, value, onChange, extraRoom = 0) {
    return (
      <select id={id} value={value} aria-invalid={Boolean(fieldError)} onChange={(e) => { setFieldError(null); onChange(e.target.value) }}>
        <option value="" disabled>Select a reward</option>
        {catalog.map((item) => {
          const stock = item.stock == null ? '' : ` · ${item.stock} left`
          return (
            <option key={item.id} value={item.id} disabled={item.stock === 0 || item.pointsCost > available + extraRoom}>
              {item.name} — {item.pointsCost} pts{stock}
            </option>
          )
        })}
      </select>
    )
  }

  const editingRequest = editing ? items.find((r) => r.id === editing.id) : null

  return (
    <>
      {confirmDialog}

      <FormModal
        open={Boolean(showForm)}
        onClose={closeCreate}
        title="Request a redemption"
        subtitle={`${available.toLocaleString()} points available${reserved > 0 ? ` (${reserved} already requested)` : ''}`}
      >
        {catalog.length === 0 ? (
          <p className="admin-empty">No rewards are available yet. Check back soon.</p>
        ) : (
          <form className="admin-form" onSubmit={handleCreate} noValidate>
            <div>
              <label htmlFor="redeem-item">Reward</label>
              {rewardSelect('redeem-item', chosen, setChosen)}
              {fieldError && <p className="ac-field-error" role="alert" style={{ color: '#8a1c12', fontWeight: 700, fontSize: 12 }}>{fieldError}</p>}
            </div>
            <div className="ecoc-modal-actions">
              <button type="button" className="btn-secondary btn-sm" onClick={closeCreate}>Cancel</button>
              <button type="submit" className="btn-primary btn-sm" disabled={busy || !canRequest}>Send request</button>
            </div>
          </form>
        )}
      </FormModal>

      <FormModal
        open={Boolean(editing)}
        onClose={closeEdit}
        title="Change your request"
        subtitle="Pick a different reward. Your points stay set aside until an admin decides."
      >
        {editing && (
          <form className="admin-form" onSubmit={handleSave} noValidate>
            <div>
              <label htmlFor="change-item">Reward</label>
              {rewardSelect('change-item', editing.rewardItemId, (value) => setEditing({ ...editing, rewardItemId: value }), editingRequest?.points ?? 0)}
              {fieldError && <p className="ac-field-error" role="alert" style={{ color: '#8a1c12', fontWeight: 700, fontSize: 12 }}>{fieldError}</p>}
            </div>
            <div className="ecoc-modal-actions">
              <button type="button" className="btn-secondary btn-sm" onClick={closeEdit}>Cancel</button>
              <button type="submit" className="btn-primary btn-sm" disabled={busy}>Save</button>
            </div>
          </form>
        )}
      </FormModal>

      <AdminCard title="My redemption requests">
        {loading ? (
          <p className="admin-loading">Loading requests…</p>
        ) : items.length === 0 ? (
          <p className="admin-empty">No redemption requests yet.</p>
        ) : (
          <ul className="resident-activity-list">
            {items.map((item) => (
              <li key={item.id} className="resident-activity-item" style={{ flexWrap: 'wrap' }}>
                <div className="resident-activity-body">
                  <strong>{item.reason}</strong>
                  <small>
                    {formatDate(item.createdAt)} · {item.status}
                    {item.adminNote ? ` · Admin: ${item.adminNote}` : ''}
                  </small>
                </div>
                <span className="leaderboard-points">{item.points}</span>
                {item.status === 'Pending' && (
                  <span className="admin-actions">
                    <button type="button" className="btn-secondary btn-sm" disabled={busy}
                      onClick={() => { setFieldError(null); setEditing({ id: item.id, rewardItemId: item.rewardItemId ?? '' }) }}>
                      Change
                    </button>
                    <button type="button" className="btn-secondary btn-sm" disabled={busy}
                      onClick={() => handleCancel(item)}>
                      Cancel request
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </>
  )
}
