/**
 * Display helpers for the collector screens.
 *
 * The prototype shows times like "10:15 am" and greets by first name; the API
 * gives ISO timestamps and the session gives a full name, so the shaping is
 * here rather than repeated in both pages.
 */

/**
 * "10:15 am", for a moment that really happened -- a completion timestamp.
 *
 * NOT for a stop's scheduledDate. Nothing in the system books a stop for a
 * time: RouteAssignment.ScheduledDate is a date, written as midnight UTC, and
 * there are no start or end times anywhere in the model. Formatting it as a
 * clock printed the same invented time against every stop on the round --
 * "5:30 AM" for all of them, in UTC+5:30. Use formatStopDay for that.
 */
export function formatStopTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/**
 * "Today, 3 Oct", "Yesterday, 2 Oct", "Tomorrow, 4 Oct", or "Tue 7 Oct".
 *
 * The honest reading of a scheduledDate, which carries a day and nothing more.
 *
 * The real date is always shown next to the word. "Yesterday" alone is a
 * relative label on a screen that may have been open for hours, and on a round
 * that carries unfinished stops forward there is no way to tell which day a
 * bare "Yesterday" was counted from.
 *
 * Days are counted in the browser's own timezone, which is the service's:
 * ServiceClock on the backend turns the day over at midnight in Asia/Colombo,
 * and a crew reads this screen in that same local day. Counting in UTC here
 * would put the two 5.5 hours apart and label the early morning as yesterday.
 */
export function formatStopDay(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  // A stored day is midnight UTC, so read the date parts in UTC; compare them
  // against today as the person in front of the screen counts it.
  const day = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const short = day.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  const diff = Math.round((day - today) / 86400000)

  if (diff === 0) return `Today, ${short}`
  if (diff === 1) return `Tomorrow, ${short}`
  if (diff === -1) return `Yesterday, ${short}`
  return day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

/**
 * When collections happen, on any day the service runs.
 *
 * One window for the whole service rather than a time per pickup: nothing in
 * the system books a stop for an hour, and inventing one per row would be a
 * promise nobody made. Stated once here so the resident, the collector and the
 * admin all quote the same hours.
 */
export const COLLECTION_WINDOW = { start: '8:30 am', end: '4:00 pm' }

/** "8:30 am – 4:00 pm". */
export const COLLECTION_WINDOW_LABEL =
  `${COLLECTION_WINDOW.start} – ${COLLECTION_WINDOW.end}`

/** "Today, 8:30 am – 4:00 pm" — the day a stop is booked, plus the hours. */
export function formatStopWhen(value) {
  return `${formatStopDay(value)} · ${COLLECTION_WINDOW_LABEL}`
}

/** "Tuesday 29 September", for the top bar. */
export function formatShiftDate(value = new Date()) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** Morning / afternoon / evening, from the collector's own clock. */
export function greeting(now = new Date()) {
  const hour = now.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * The first name to greet, taken from the Supabase session.
 *
 * There is no resident or collector name in the API -- /profiles is admin-only
 * -- so the signed-in user's own metadata is the only real source, and the email
 * local part is the fallback.
 */
export function firstName(user) {
  const full = user?.user_metadata?.full_name?.trim()
  if (full) return full.split(/\s+/)[0]
  const email = user?.email
  if (!email) return 'there'
  return email.split('@')[0]
}

/** "Borella and Colombo North", or "Borella, Colombo North and Kotte". */
export function joinNames(names = []) {
  if (names.length === 0) return null
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}
