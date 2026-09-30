import { useCallback, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { AcCard, AcChips } from './AcUi'
import { AcStatusPill } from './AcPills'
import FormModal from '../FormModal'
import { apiRequest, formatDate } from '../../lib/api'
import { hasErrors, validateReview } from '../../lib/rewardValidation'

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'Pending', label: 'Pending' },
  { key: 'Approved', label: 'Approved' },
  { key: 'Rejected', label: 'Rejected' },
]

const STATUS_LABELS = { Approved: 'Approved', Pending: 'Pending', Rejected: 'Rejected' }

/**
 * Admin review of residents' redemption requests: filter by status, search by
 * resident or item, then approve (points leave the ledger) or decline. Each
 * decision opens a pop-up with a note field; declining requires a note.
 */
export default function RedemptionRequestsPanel({ onError, onSuccess, onChanged }) {
  const [status, setStatus] = useState('Pending')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [reviewing, setReviewing] = useState(null) // { request, action, note }
  const [noteError, setNoteError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: '8' })
      if (status) query.set('status', status)
      if (search.trim()) query.set('search', search.trim())
      setData(await apiRequest(`/redemptions?${query}`))
    } catch (err) {
      onError?.(err.message)
    } finally {
      setLoading(false)
    }
  }, [status, search, page, onError])

  useEffect(() => {
    const timer = setTimeout(load, search ? 250 : 0)
    return () => clearTimeout(timer)
  }, [load, search])

  const closeReview = useCallback(() => {
    setReviewing(null)
    setNoteError(null)
  }, [])

  function openReview(request, action) {
    setNoteError(null)
    setReviewing({ request, action, note: '' })
  }

  async function submitReview(e) {
    e.preventDefault()
    const { request, action, note } = reviewing
    const found = validateReview(action, note)
    setNoteError(found.note ?? null)
    if (hasErrors(found)) return

    setBusy(true)
    try {
      await apiRequest(`/redemptions/${request.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ adminNote: note.trim() }),
      })
      onSuccess?.(action === 'approve'
        ? 'Redemption approved and points deducted.'
        : { text: 'Redemption declined.', tone: 'danger' })
      closeReview()
      await load()
      onChanged?.()
      // The sidebar badge counts pending requests.
      window.dispatchEvent(new Event('ecocycle-redemptions-updated'))
    } catch (err) {
      onError?.(err.message)
    } finally {
      setBusy(false)
    }
  }

  const items = data?.items ?? []
  const approving = reviewing?.action === 'approve'

  return (
    <AcCard title="Requests" subtitle="Approve to deduct the points, or decline with a note">
      <FormModal
        open={Boolean(reviewing)}
        onClose={closeReview}
        title={approving ? 'Approve redemption' : 'Decline redemption'}
        subtitle={reviewing && `${reviewing.request.residentName} · ${reviewing.request.reason} · ${reviewing.request.points.toLocaleString()} points`}
      >
        {reviewing && (
          <form className="ac-form" onSubmit={submitReview} noValidate>
            <p className="ac-foot">
              {approving
                ? `${reviewing.request.points.toLocaleString()} points are deducted from the resident's balance and one item comes off the shelf.`
                : 'Nothing is deducted. The resident sees your note.'}
            </p>
            <div className="ac-field">
              <label htmlFor="review-note">
                {approving ? 'Note to resident (optional)' : 'Reason for declining (required)'}
              </label>
              <input
                id="review-note"
                value={reviewing.note}
                maxLength={500}
                aria-invalid={Boolean(noteError)}
                onChange={(e) => setReviewing({ ...reviewing, note: e.target.value })}
              />
              {noteError && <p className="ac-field-error" role="alert">{noteError}</p>}
            </div>
            <div className="ecoc-modal-actions">
              <button type="button" className="ac-btn ac-btn-ghost" onClick={closeReview}>Cancel</button>
              <button type="submit" className={`ac-btn ${approving ? 'ac-btn-primary' : 'ac-btn-danger'}`} disabled={busy}>
                {approving ? 'Approve' : 'Decline'}
              </button>
            </div>
          </form>
        )}
      </FormModal>

      <div className="ac-toolbar">
        <AcChips options={FILTERS} value={status} onChange={(key) => { setStatus(key); setPage(1) }} label="Filter by status" />
        <label className="ac-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search resident or item"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            aria-label="Search redemption requests"
          />
        </label>
      </div>

      {loading ? (
        <p className="ac-empty">Loading requests…</p>
      ) : items.length === 0 ? (
        <p className="ac-empty">No redemption requests match.</p>
      ) : (
        <ul className="ac-list">
          {items.map((item) => (
            <li className="ac-row" key={item.id} style={{ flexWrap: 'wrap' }}>
              <span className="ac-grow">
                <strong>{item.residentName}</strong>
                <small style={{ display: 'block' }}>
                  {item.reason} · {formatDate(item.createdAt)}
                  {item.adminNote ? ` · Note: ${item.adminNote}` : ''}
                </small>
              </span>
              <span className="ac-v">{item.points.toLocaleString()} pts</span>
              <AcStatusPill status={item.status} label={STATUS_LABELS[item.status]} />
              {item.status === 'Pending' && (
                <span style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="ac-btn ac-btn-primary ac-btn-sm" disabled={busy} onClick={() => openReview(item, 'approve')}>
                    Approve
                  </button>
                  <button type="button" className="ac-btn ac-btn-danger ac-btn-sm" disabled={busy} onClick={() => openReview(item, 'reject')}>
                    Decline
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {data && data.totalPages > 1 && (
        <div className="ac-pager" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
          <button type="button" className="ac-btn ac-btn-ghost ac-btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>Page {page} of {data.totalPages}</span>
          <button type="button" className="ac-btn ac-btn-ghost ac-btn-sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      )}
    </AcCard>
  )
}
