import { useCallback, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { AcCard, AcChips } from './AcUi'
import { AcStatusPill } from './AcPills'
import FormModal from '../FormModal'
import { useConfirm } from '../../hooks/useConfirm'
import { apiRequest } from '../../lib/api'
import { hasErrors, validateRewardItem } from '../../lib/rewardValidation'

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'true', label: 'Active' },
  { key: 'false', label: 'Hidden' },
]

const EMPTY_FORM = { name: '', description: '', pointsCost: 100, stock: '', isActive: true }

/**
 * The catalog residents redeem from. Admins add items, change their cost or
 * stock, hide them from residents, or delete them. Adding and editing happen
 * in a pop-up; deleting asks for confirmation first.
 */
export default function RewardCatalogPanel({ onError, onSuccess, onChanged, reloadKey = 0 }) {
  const [active, setActive] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(null) // null = closed; { id?, ...fields }
  const [errors, setErrors] = useState({})
  const [confirmDialog, confirm] = useConfirm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: '8' })
      if (active) query.set('isActive', active)
      if (search.trim()) query.set('search', search.trim())
      setData(await apiRequest(`/reward-items?${query}`))
    } catch (err) {
      onError?.(err.message)
    } finally {
      setLoading(false)
    }
  }, [active, search, page, onError])

  useEffect(() => {
    const timer = setTimeout(load, search ? 250 : 0)
    return () => clearTimeout(timer)
    // reloadKey is a trigger: the parent bumps it when stock may have changed.
  }, [load, search, reloadKey])

  const closeForm = useCallback(() => {
    setForm(null)
    setErrors({})
  }, [])

  function openAdd() {
    setErrors({})
    setForm({ ...EMPTY_FORM })
  }

  function openEdit(item) {
    setErrors({})
    setForm({
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      pointsCost: item.pointsCost,
      stock: item.stock ?? '',
      isActive: item.isActive,
    })
  }

  async function save(e) {
    e.preventDefault()
    const found = validateRewardItem(form)
    setErrors(found)
    if (hasErrors(found)) return

    setBusy(true)
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      pointsCost: Number(form.pointsCost),
      stock: form.stock === '' ? null : Number(form.stock),
      isActive: form.isActive,
    }
    try {
      await apiRequest(form.id ? `/reward-items/${form.id}` : '/reward-items', {
        method: form.id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      })
      onSuccess?.(form.id ? 'Reward item updated.' : 'Reward item added.')
      closeForm()
      await load()
      onChanged?.()
    } catch (err) {
      onError?.(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(item) {
    setBusy(true)
    try {
      await apiRequest(`/reward-items/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: item.name,
          description: item.description,
          pointsCost: item.pointsCost,
          stock: item.stock,
          isActive: !item.isActive,
        }),
      })
      onSuccess?.(item.isActive ? 'Item hidden from residents.' : 'Item is now available to residents.')
      await load()
      onChanged?.()
    } catch (err) {
      onError?.(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(item) {
    const ok = await confirm({
      title: `Delete "${item.name}"?`,
      message: 'It disappears from the catalog for good. Requests that already used it keep their record.',
      confirmLabel: 'Delete item',
      danger: true,
    })
    if (!ok) return

    setBusy(true)
    try {
      await apiRequest(`/reward-items/${item.id}`, { method: 'DELETE' })
      onSuccess?.({ text: 'Reward item deleted.', tone: 'danger' })
      await load()
      onChanged?.()
    } catch (err) {
      onError?.(err.message)
    } finally {
      setBusy(false)
    }
  }

  const items = data?.items ?? []

  return (
    <AcCard
      title="Items"
      subtitle="What residents can spend their points on"
      action={(
        <button type="button" className="ac-btn ac-btn-primary ac-btn-sm" onClick={openAdd}>
          Add item
        </button>
      )}
    >
      <FormModal
        open={Boolean(form)}
        onClose={closeForm}
        title={form?.id ? 'Edit reward item' : 'Add reward item'}
        subtitle="Residents pick from these when they redeem points."
      >
        {form && (
          <form className="ac-form" onSubmit={save} noValidate>
            <div className="ac-field">
              <label htmlFor="item-name">Name</label>
              <input id="item-name" value={form.name} maxLength={120} aria-invalid={Boolean(errors.name)}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
              {errors.name && <p className="ac-field-error" role="alert">{errors.name}</p>}
            </div>
            <div className="ac-two">
              <div className="ac-field">
                <label htmlFor="item-cost">Points cost</label>
                <input id="item-cost" type="number" min="1" step="1" value={form.pointsCost}
                  aria-invalid={Boolean(errors.pointsCost)}
                  onChange={(e) => setForm({ ...form, pointsCost: e.target.value })} />
                {errors.pointsCost && <p className="ac-field-error" role="alert">{errors.pointsCost}</p>}
              </div>
              <div className="ac-field">
                <label htmlFor="item-stock">Stock (empty = unlimited)</label>
                <input id="item-stock" type="number" min="0" step="1" value={form.stock}
                  aria-invalid={Boolean(errors.stock)}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                {errors.stock && <p className="ac-field-error" role="alert">{errors.stock}</p>}
              </div>
            </div>
            <div className="ac-field">
              <label htmlFor="item-desc">Description</label>
              <input id="item-desc" value={form.description} maxLength={500}
                aria-invalid={Boolean(errors.description)}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
              {errors.description && <p className="ac-field-error" role="alert">{errors.description}</p>}
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Available to residents
            </label>
            <div className="ecoc-modal-actions">
              <button type="button" className="ac-btn ac-btn-ghost" onClick={closeForm}>Cancel</button>
              <button type="submit" className="ac-btn ac-btn-primary" disabled={busy}>
                {form.id ? 'Save changes' : 'Add item'}
              </button>
            </div>
          </form>
        )}
      </FormModal>

      <div className="ac-toolbar">
        <AcChips options={FILTERS} value={active} onChange={(key) => { setActive(key); setPage(1) }} label="Filter catalog" />
        <label className="ac-search">
          <Search size={15} aria-hidden="true" />
          <input type="search" placeholder="Search items" value={search} aria-label="Search reward items"
            onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </label>
      </div>

      {loading ? (
        <p className="ac-empty">Loading catalog…</p>
      ) : items.length === 0 ? (
        <p className="ac-empty">No reward items yet. Add one so residents have something to redeem.</p>
      ) : (
        <ul className="ac-list">
          {items.map((item) => (
            <li className="ac-row" key={item.id} style={{ flexWrap: 'wrap' }}>
              <span className="ac-grow">
                <strong>{item.name}</strong>
                <small style={{ display: 'block' }}>
                  {item.description || 'No description'} · {item.stock == null ? 'Unlimited' : `${item.stock} left`}
                </small>
              </span>
              <span className="ac-v">{item.pointsCost.toLocaleString()} pts</span>
              <AcStatusPill status={item.isActive ? 'Active' : 'Inactive'} label={item.isActive ? 'Available' : 'Hidden'} />
              <span style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="ac-btn ac-btn-ghost ac-btn-sm" disabled={busy} onClick={() => openEdit(item)}>Edit</button>
                <button type="button" className="ac-btn ac-btn-ghost ac-btn-sm" disabled={busy} onClick={() => toggleActive(item)}>
                  {item.isActive ? 'Hide' : 'Show'}
                </button>
                <button type="button" className="ac-btn ac-btn-danger ac-btn-sm" disabled={busy} onClick={() => remove(item)}>Delete</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {confirmDialog}

      {data && data.totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
          <button type="button" className="ac-btn ac-btn-ghost ac-btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {data.totalPages}</span>
          <button type="button" className="ac-btn ac-btn-ghost ac-btn-sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </AcCard>
  )
}
