import { useCallback, useEffect, useState } from 'react'
import { Check, FlaskConical, Package, Truck } from 'lucide-react'
import { AcCard } from './AcUi'
import { apiRequest } from '../../lib/api'

/**
 * What each collector's round can take: stops per day, and which restricted
 * categories their vehicle is equipped for.
 *
 * These are the limits the routing agent plans around, so they live next to the
 * zones rather than on a page of their own -- an admin setting up a round needs
 * both in front of them.
 */
export default function CollectorSettingsCard({ onSaved }) {
  const [rows, setRows] = useState([])
  const [draft, setDraft] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    apiRequest('/collector-settings')
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => { load() }, [load])

  // Edits are held per collector until saved, so typing in one row cannot
  // overwrite another, and an unsaved row still shows what is stored.
  function valueOf(row, field) {
    return draft[row.collectorId]?.[field] ?? row[field]
  }

  function edit(row, field, value) {
    setDraft((d) => ({
      ...d,
      [row.collectorId]: { ...d[row.collectorId], [field]: value },
    }))
  }

  async function save(row) {
    setBusyId(row.collectorId)
    setError(null)
    try {
      await apiRequest(`/collector-settings/${row.collectorId}`, {
        method: 'PUT',
        body: JSON.stringify({
          dailyCapacity: Number(valueOf(row, 'dailyCapacity')) || 1,
          handlesBulky: Boolean(valueOf(row, 'handlesBulky')),
          handlesHazardous: Boolean(valueOf(row, 'handlesHazardous')),
        }),
      })
      setDraft((d) => {
        const next = { ...d }
        delete next[row.collectorId]
        return next
      })
      load()
      onSaved?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AcCard
      title="Collector capacity"
      subtitle="What each round can take. The router plans around these"
    >
      {error && <p className="ac-empty">{error}</p>}

      {rows.length === 0 ? (
        <p className="ac-empty">No collectors yet.</p>
      ) : (
        <div className="ac-table-wrap">
          <table className="ac-table">
            <thead>
              <tr>
                <th>Collector</th>
                <th>Stops per day</th>
                <th>Bulky</th>
                <th>Hazardous</th>
                <th><span className="ac-sr-only">Save</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const dirty = Boolean(draft[row.collectorId])
                return (
                  <tr key={row.collectorId}>
                    <td>
                      <strong>{row.collectorName}</strong>
                      {/* Says plainly that nobody has set this up, so the
                          defaults are not mistaken for someone's decision. */}
                      {!row.isConfigured && <span className="ac-sub">Using defaults</span>}
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="ac-mini-input"
                        value={valueOf(row, 'dailyCapacity')}
                        onChange={(e) => edit(row, 'dailyCapacity', e.target.value)}
                        aria-label={`Stops per day for ${row.collectorName}`}
                      />
                    </td>
                    <td>
                      <label className="ac-check">
                        <input
                          type="checkbox"
                          checked={Boolean(valueOf(row, 'handlesBulky'))}
                          onChange={(e) => edit(row, 'handlesBulky', e.target.checked)}
                        />
                        <Package size={14} strokeWidth={2} aria-hidden="true" />
                        <span className="ac-sr-only">Has a lift for bulky items</span>
                      </label>
                    </td>
                    <td>
                      <label className="ac-check">
                        <input
                          type="checkbox"
                          checked={Boolean(valueOf(row, 'handlesHazardous'))}
                          onChange={(e) => edit(row, 'handlesHazardous', e.target.checked)}
                        />
                        <FlaskConical size={14} strokeWidth={2} aria-hidden="true" />
                        <span className="ac-sr-only">Licensed for hazardous waste</span>
                      </label>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ac-btn ac-btn-primary ac-btn-sm"
                        disabled={!dirty || busyId === row.collectorId}
                        onClick={() => save(row)}
                      >
                        <Check size={14} strokeWidth={2.4} aria-hidden="true" />
                        Save
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="ac-note">
        <Truck size={14} strokeWidth={2} aria-hidden="true" />{' '}
        A pickup is only offered to a collector whose vehicle can carry it and who has room
        left that day.
      </p>
    </AcCard>
  )
}
