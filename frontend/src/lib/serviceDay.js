// What day and time it is for the collection service, which runs on Sri Lanka
// time. The device's own clock and timezone are not used for this: a resident
// booking from abroad, or a laptop set to UTC, must see the same "today" the
// crews and the API do.

const SERVICE_TIME_ZONE = 'Asia/Colombo'

// A pickup can go on today's round until this hour (24-hour clock). Kept in
// step with ServiceClock.SameDayCutoff in the API and sameDayCutoffHour in
// mobile/lib/services/service_day.dart.
export const SAME_DAY_CUTOFF_HOUR = 12
export const SAME_DAY_CUTOFF_LABEL = '12 noon'

const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: SERVICE_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
})

/** { year, month (1-12), day, hour, minute } in the service's timezone. */
export function serviceNow(now = new Date()) {
  const out = {}
  for (const { type, value } of PARTS.formatToParts(now)) {
    if (type !== 'literal') out[type] = Number(value)
  }
  return out
}

/** The service's calendar day as a local-midnight Date, for comparing with calendar cells. */
export function serviceToday(now = new Date()) {
  const { year, month, day } = serviceNow(now)
  return new Date(year, month - 1, day)
}

/** Whether a pickup booked now can still go on today's round. */
export function sameDayOpen(now = new Date()) {
  return serviceNow(now).hour < SAME_DAY_CUTOFF_HOUR
}
