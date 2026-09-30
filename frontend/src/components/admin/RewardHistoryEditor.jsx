import { useCallback, useState } from 'react'
import FormModal from '../FormModal'
import { useConfirm } from '../../hooks/useConfirm'
import { apiRequest, formatDate, shortId } from '../../lib/api'
import { hasErrors, validatePointsEntry } from '../../lib/rewardValidation'

/**
 * A resident's points ledger with the admin corrections: change an entry's
 * points or reason (a pop-up form, PUT) or reverse it entirely (confirmation
 * first, then DELETE).
 */
export default function RewardHistoryEditor({ history, onChanged, onError, onSuccess }) {
  const [editing, setEditing] = useState(null) // { id, pointsEarned, reason }
  const [errors, setErrors] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [confirmDialog, confirm] = useConfirm()

  const closeEdit = useCallback(() => {
    setEditing(null)
    setErrors({})
  }, [])

  async function save(e) {
    e.preventDefault()
    const found = validatePointsEntry(editing)
    setErrors(found)
    if (hasErrors(found)) return

    setBusyId(editing.id)
    try {
      await apiRequest(`/rewards/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({ pointsEarned: Number(editing.pointsEarned), reason: editing.reason.trim() }),
      })
      onSuccess?.('Points entry updated.')
      closeEdit()
      await onChanged?.()
    } catch (err) {
      onError?.(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function remove(item) {
    const label = `${item.pointsEarned > 0 ? '+' : ''}${item.pointsEarned} pts: ${item.reason}`
    const change = -item.pointsEarned
    const ok = await confirm({
      title: 'Reverse this entry?',
      message: `${label}\n\nIt is removed from the resident's history and their balance changes by ${change > 0 ? '+' : ''}${change} points.`,
      confirmLabel: 'Reverse entry',
      danger: true,
    })
    if (!ok) return

    setBusyId(item.id)
    try {
      await apiRequest(`/rewards/${item.id}`, { method: 'DELETE' })
      onSuccess?.({ text: 'Points entry reversed.', tone: 'danger' })
      await onChanged?.()
    } catch (err) {
      onError?.(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      {confirmDialog}

      <FormModal
        open={Boolean(editing)}
        onClose={closeEdit}
        title="Edit points entry"
        subtitle="Correct the points or the reason. The resident's balance updates."
      >
        {editing && (
          <form className="ac-form" onSubmit={save} noValidate>
            <div className="ac-field">
              <label htmlFor="entry-points">Points</label>
              <input
                id="entry-points"
                type="number"
                step="1"
                value={editing.pointsEarned}
                aria-invalid={Boolean(errors.pointsEarned)}
                onChange={(e) => setEditing({ ...editing, pointsEarned: e.target.value })}
              />
              {errors.pointsEarned && <p className="ac-field-error" role="alert">{errors.pointsEarned}</p>}
            </div>
            <div className="ac-field">
              <label htmlFor="entry-reason">Reason</label>
              <input
                id="entry-reason"
                value={editing.reason}
                maxLength={500}
                aria-invalid={Boolean(errors.reason)}
                onChange={(e) => setEditing({ ...editing, reason: e.target.value })}
              />
              {errors.reason && <p className="ac-field-error" role="alert">{errors.reason}</p>}
            </div>
            <div className="ecoc-modal-actions">
              <button type="button" className="ac-btn ac-btn-ghost" onClick={closeEdit}>Cancel</button>
              <button type="submit" className="ac-btn ac-btn-primary" disabled={busyId === editing.id}>
                Save changes
              </button>
            </div>
          </form>
        )}
      </FormModal>

      <p className="ac-foot">
        Current balance: <strong>{history.currentBalance.toLocaleString()} pts</strong>
      </p>
      <div className="ac-table-wrap">
        <table className="ac-table">
          <thead>
            <tr><th>Date</th><th>Points</th><th>Reason</th><th>Pickup</th><th><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {history.items.map((item) => (
              <tr key={item.id}>
                <td>{formatDate(item.createdAt)}</td>
                <td>{item.pointsEarned > 0 ? `+${item.pointsEarned}` : item.pointsEarned}</td>
                <td>{item.reason}</td>
                <td>{item.pickupRequestId ? shortId(item.pickupRequestId) : '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    type="button"
                    className="ac-btn ac-btn-ghost ac-btn-sm"
                    disabled={busyId === item.id}
                    onClick={() => {
                      setErrors({})
                      setEditing({ id: item.id, pointsEarned: item.pointsEarned, reason: item.reason })
                    }}
                  >
                    Edit
                  </button>{' '}
                  <button
                    type="button"
                    className="ac-btn ac-btn-danger ac-btn-sm"
                    disabled={busyId === item.id}
                    onClick={() => remove(item)}
                  >
                    Reverse
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
