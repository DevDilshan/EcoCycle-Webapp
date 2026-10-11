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

/// A calendar day as the API stores it: midnight UTC of that date.
///
/// Converting a local midnight with toUtc() would move it to the evening
/// before in Sri Lanka (18:30 the previous day), so the API would read the
/// pickup as booked for a day earlier than the one the resident chose.
String serviceDayToApi(DateTime day) =>
    DateTime.utc(day.year, day.month, day.day).toIso8601String();

/// Reads a day from the API back as a local-midnight calendar date.
DateTime? serviceDayFromApi(String? value) {
  final parsed = DateTime.tryParse(value ?? '');
  if (parsed == null) return null;
  final utc = parsed.toUtc();
  final atMidnight = utc.hour == 0 && utc.minute == 0 && utc.second == 0;
  // Days saved by older app versions carry a local midnight converted to
  // UTC; reading those in local time gives back the day that was chosen.
  final day = atMidnight ? utc : parsed.toLocal();
  return DateTime(day.year, day.month, day.day);
}
