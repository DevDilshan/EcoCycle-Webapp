import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTH_FORMAT = { month: 'long', year: 'numeric' }

// yyyy-MM-dd from local parts, which is what the form state holds.
// toISOString() would convert to UTC first, which in UTC+5:30 turns an
// early-morning date into the day before.
function toDateValue(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function startOfDay(date) {
  const out = new Date(date)
  out.setHours(0, 0, 0, 0)
  return out
}

/**
 * A month calendar whose unavailable days are shown but not selectable.
 *
 * A native `<input type="date">` cannot disable individual days, and a dropdown
 * of the handful of valid dates hides the shape of the schedule -- a resident
 * cannot see that their zone is Mondays and Sundays, only that eight particular
 * dates are on offer. Greying the rest keeps the calendar they already know how
 * to read and makes the pattern visible at a glance.
 *
 * @param value      selected day as yyyy-MM-dd, or '' for none
 * @param onChange   called with the new yyyy-MM-dd
 * @param isDayOpen  (Date) => boolean; every day is open when omitted
 * @param maxDays    how far ahead may be chosen, counted from today
 */
export default function CollectionDayPicker({
  value,
  onChange,
  isDayOpen,
  maxDays = 365,
  id,
}) {
  const today = useMemo(() => startOfDay(new Date()), [])

  // The month on show starts on the selected day's month so an existing choice
  // is visible straight away, rather than the resident having to page to it.
  const [cursor, setCursor] = useState(() => {
    const from = value ? new Date(`${value}T00:00:00`) : today
    return new Date(from.getFullYear(), from.getMonth(), 1)
  })

  const last = useMemo(() => {
    const out = new Date(today)
    out.setDate(out.getDate() + maxDays)
    return out
  }, [today, maxDays])

  const open = (day) => {
    // Tomorrow at the earliest: the round for today is already out.
    if (day <= today || day > last) return false
    return isDayOpen ? isDayOpen(day) : true
  }

  // Leading blanks so the 1st falls under its own weekday column.
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const dayCount = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
    const out = Array.from({ length: first.getDay() }, () => null)
    for (let d = 1; d <= dayCount; d += 1) {
      out.push(new Date(cursor.getFullYear(), cursor.getMonth(), d))
    }
    return out
  }, [cursor])

  const shift = (months) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + months, 1))

  // Paging past the window would show a month in which nothing can be picked.
  const canGoBack = cursor > new Date(today.getFullYear(), today.getMonth(), 1)
  const canGoForward = cursor < new Date(last.getFullYear(), last.getMonth(), 1)

  return (
    <div className="r-cal" id={id}>
      <div className="r-cal-head">
        <button
          type="button"
          className="ac-icon-btn"
          onClick={() => shift(-1)}
          disabled={!canGoBack}
          aria-label="Previous month"
        >
          <ChevronLeft size={16} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <strong aria-live="polite">
          {cursor.toLocaleDateString(undefined, MONTH_FORMAT)}
        </strong>
        <button
          type="button"
          className="ac-icon-btn"
          onClick={() => shift(1)}
          disabled={!canGoForward}
          aria-label="Next month"
        >
          <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>

      <div className="r-cal-grid" role="grid">
        {WEEKDAY_INITIALS.map((initial, i) => (
          // The initials repeat (S, T), so the key is the column, not the letter.
          <span className="r-cal-wd" key={i} aria-hidden="true">{initial}</span>
        ))}

        {cells.map((day, i) => {
          if (!day) return <span className="r-cal-pad" key={`pad-${i}`} />
          const dayValue = toDateValue(day)
          const selectable = open(day)
          const selected = dayValue === value
          return (
            <button
              type="button"
              key={dayValue}
              className={`r-cal-day${selected ? ' is-on' : ''}`}
              disabled={!selectable}
              aria-pressed={selected}
              aria-label={day.toLocaleDateString(undefined, {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
              onClick={() => onChange(dayValue)}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
