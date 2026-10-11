/// What day and time it is for the collection service, which runs on Sri Lanka
/// time (UTC+5:30, no daylight saving). The phone's own timezone is not used:
/// a resident abroad must see the same "today" the crews and the API do.
library;

/// A pickup can go on today's round until this hour (24-hour clock). Kept in
/// step with ServiceClock.SameDayCutoff in the API and SAME_DAY_CUTOFF_HOUR in
/// frontend/src/lib/serviceDay.js.
const sameDayCutoffHour = 12;
const sameDayCutoffLabel = '12 noon';

const _serviceOffset = Duration(hours: 5, minutes: 30);

/// The current moment as wall-clock time in Sri Lanka.
DateTime serviceNow([DateTime? now]) =>
    (now ?? DateTime.now()).toUtc().add(_serviceOffset);

/// The service's calendar day, as a local-midnight date for comparing with
/// the dates a date picker hands back.
DateTime serviceToday([DateTime? now]) {
  final n = serviceNow(now);
  return DateTime(n.year, n.month, n.day);
}

/// Whether a pickup booked now can still go on today's round.
bool sameDayOpen([DateTime? now]) => serviceNow(now).hour < sameDayCutoffHour;

/// The first day a new pickup can be booked for: today until the cut-off,
/// tomorrow after it.
DateTime earliestBookingDay([DateTime? now]) {
  final today = serviceToday(now);
  return sameDayOpen(now)
      ? today
      : DateTime(today.year, today.month, today.day + 1);
}
