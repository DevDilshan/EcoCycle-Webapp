/**
 * Display helpers for the collector screens.
 *
 * The prototype shows times like "10:15 am" and greets by first name; the API
 * gives ISO timestamps and the session gives a full name, so the shaping is
 * here rather than repeated in both pages.
 */

/** "10:15 am" — a stop's time is all a collector needs; the date is today. */
export function formatStopTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
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
