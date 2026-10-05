import { useCallback, useEffect, useState } from 'react'
import { Gift, Pencil, Trash2 } from 'lucide-react'
import { AcCard, AcModal } from '../admin/AcUi'
import { AcStatusPill } from '../admin/AcPills'
import { useConfirm } from '../../hooks/useConfirm'
import { apiRequest, formatDate } from '../../lib/api'
import RedemptionTicket from './RedemptionTicket'
import RewardImage from '../rewards/RewardImage'
import { addressError, deliveryOf, redemptionPillStatus, redemptionStatusLabel } from '../../lib/redemption'

/**
 * The resident's redemption requests. They pick an item from the catalog in a
 * drawer; a Pending request can be switched to another item (also a drawer) or
 * cancelled after a confirmation. Points only leave the balance once an admin
 * approves.
 *
 * Uses the shared console drawer rather than the older FormModal, so the two
 * forms here look and behave like every other form in the app.
 */
export default function MyRedemptions({ canRequest, balance, showForm, onCloseForm, onError, onSuccess, onChanged }) {
  const [items, setItems] = useState([])
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [chosen, setChosen] = useState('')
  const [address, setAddress] = useState('')
  const [addressProblem, setAddressProblem] = useState(null)
  const [editing, setEditing] = useState(null) // { id, rewardItemId, address }
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
    setAddress('')
    setAddressProblem(null)
    setFieldError(null)
    onCloseForm?.()
  }

  const closeEdit = useCallback(() => {
    setEditing(null)
    setAddressProblem(null)
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
    const problem = addressError(catalog.find((c) => c.id === chosen), address)
    setAddressProblem(problem)
    if (problem) return
    const ok = await run(
      () => apiRequest('/redemptions', {
        method: 'POST',
        body: JSON.stringify({ rewardItemId: chosen, deliveryAddress: address.trim() || null }),
      }),
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
    const problem = addressError(catalog.find((c) => c.id === editing.rewardItemId), editing.address)
    setAddressProblem(problem)
    if (problem) return
    const ok = await run(
      () => apiRequest(`/redemptions/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({ rewardItemId: editing.rewardItemId, deliveryAddress: editing.address.trim() || null }),
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
      <div className="reward-choices" role="radiogroup" aria-label="Choose a reward" aria-invalid={Boolean(fieldError)}>
        {catalog.map((item) => {
          const soldOut = item.stock != null && item.stock <= 0
          const shortfall = Math.max(0, item.pointsCost - available - extraRoom)
          return (
            <label key={item.id} className="reward-choice">
              <RewardImage src={item.imageUrl} />
              <span className="reward-choice-copy">
                <strong>{item.name}</strong>
                <small>{item.pointsCost.toLocaleString()} pts · {deliveryOf(item).option}</small>
                {item.description && <small>{item.description}</small>}
                <small>{soldOut ? 'Sold out' : shortfall ? `${shortfall.toLocaleString()} more points needed`
                  : item.stock == null ? 'Available' : `${item.stock} left`}</small>
              </span>
              <input type="radio" name={id} value={item.id} checked={value === item.id}
                disabled={soldOut || shortfall > 0} aria-label={item.name}
                onChange={() => { setFieldError(null); onChange(item.id) }} />
            </label>
          )
        })}
      </div>
    )
  }

  // Says how the chosen reward arrives, and asks for an address if it is posted.
  function deliveryFields(id, rewardItemId, value, onChange) {
    const reward = catalog.find((c) => c.id === rewardItemId)
    if (!reward) return null
    return (
      <>
        <p className="ac-sub">How you get it: {deliveryOf(reward).option.toLowerCase()}.</p>
        {reward.delivery === 'Post' && (
          <div className="ac-field">
            <label htmlFor={id}>Address to post it to</label>
            <textarea
              id={id}
              rows={3}
              maxLength={300}
              value={value}
              aria-invalid={Boolean(addressProblem)}
              onChange={(e) => { setAddressProblem(null); onChange(e.target.value) }}
            />
            {addressProblem && <p className="ac-field-error" role="alert">{addressProblem}</p>}
          </div>
        )}
      </>
    )
  }

  const editingRequest = editing ? items.find((r) => r.id === editing.id) : null

  return (
    <>
      {confirmDialog}

      <AcModal open={Boolean(showForm)} onClose={closeCreate} title="Request a redemption">
        <p className="ac-sub">
          {available.toLocaleString()} points available
          {reserved > 0 ? ` (${reserved} already requested)` : ''}
        </p>

        {catalog.length === 0 ? (
          <p className="ac-empty">No rewards are available yet. Check back soon.</p>
        ) : (
          <form className="ac-form" onSubmit={handleCreate} noValidate>
            <div className="ac-field">
              <span>Reward</span>
              {rewardSelect('redeem-item', chosen, setChosen)}
              {fieldError && <p className="ac-field-error" role="alert">{fieldError}</p>}
            </div>
            {deliveryFields('redeem-address', chosen, address, setAddress)}
            <div className="ac-actions">
              <button type="submit" className="ac-btn ac-btn-primary" disabled={busy || !canRequest}>
                <Gift size={16} strokeWidth={2.2} aria-hidden="true" />
                Send request
              </button>
              <button type="button" className="ac-btn ac-btn-ghost" onClick={closeCreate} disabled={busy}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </AcModal>

      <AcModal open={Boolean(editing)} onClose={closeEdit} title="Change your request">
        {editing && (
          <>
            <p className="ac-sub">
              Pick a different reward. Your points stay set aside until an admin decides.
            </p>
            <form className="ac-form" onSubmit={handleSave} noValidate>
              <div className="ac-field">
                <span>Reward</span>
                {rewardSelect(
                  'change-item',
                  editing.rewardItemId,
                  (value) => setEditing({ ...editing, rewardItemId: value }),
                  editingRequest?.points ?? 0,
                )}
                {fieldError && <p className="ac-field-error" role="alert">{fieldError}</p>}
              </div>
              {deliveryFields('change-address', editing.rewardItemId, editing.address,
                (value) => setEditing({ ...editing, address: value }))}
              <div className="ac-actions">
                <button type="submit" className="ac-btn ac-btn-primary" disabled={busy}>Save</button>
                <button type="button" className="ac-btn ac-btn-ghost" onClick={closeEdit} disabled={busy}>
                  Cancel
                </button>
              </div>
            </form>
          </>
        )}
      </AcModal>

      <AcCard title="My redemption requests" subtitle="Once an admin approves, your points are deducted and you get a code to collect the reward">
        {loading ? (
          <p className="ac-loading">Loading requests…</p>
        ) : items.length === 0 ? (
          <p className="ac-empty">No redemption requests yet.</p>
        ) : (
          <ul className="ac-list">
            {items.map((item) => (
              <li className="ac-row" key={item.id} style={{ flexWrap: 'wrap' }}>
                <RewardImage src={catalog.find(reward => reward.id === item.rewardItemId)?.imageUrl} className="reward-history-image" />
                <span className="ac-grow">
                  <strong>{item.reason}</strong>
                  <span className="ac-sub">
                    {item.points} pts · {formatDate(item.createdAt)}
                    {item.adminNote ? ` · Admin: ${item.adminNote}` : ''}
                  </span>
                </span>
                <AcStatusPill status={redemptionPillStatus(item)} label={redemptionStatusLabel(item)} />
                {item.status === 'Pending' && (
                  <span className="ac-actions" style={{ marginTop: 0 }}>
                    <button
                      type="button"
                      className="ac-btn ac-btn-ghost ac-btn-sm"
                      disabled={busy}
                      onClick={() => {
                        setFieldError(null)
                        setAddressProblem(null)
                        setEditing({ id: item.id, rewardItemId: item.rewardItemId ?? '', address: item.deliveryAddress ?? '' })
                      }}
                    >
                      <Pencil size={14} strokeWidth={2.2} aria-hidden="true" />
                      Change
                    </button>
                    <button
                      type="button"
                      className="ac-btn ac-btn-danger ac-btn-sm"
                      disabled={busy}
                      onClick={() => handleCancel(item)}
                    >
                      <Trash2 size={14} strokeWidth={2.2} aria-hidden="true" />
                      Cancel
                    </button>
                  </span>
                )}
                <RedemptionTicket item={item} />
              </li>
            ))}
          </ul>
        )}
      </AcCard>
    </>
  )
}
