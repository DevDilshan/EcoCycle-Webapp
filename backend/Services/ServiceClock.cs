namespace backend.Services;

/// <summary>
/// What day it is for the collection service.
/// </summary>
/// <remarks>
/// Every date in this system is a calendar day, not a moment: a pickup is
/// booked for Tuesday, not for 00:00 on Tuesday. Those days are stored as
/// midnight UTC, which is only a storage convention.
///
/// The code used to ask <c>DateTime.UtcNow.Date</c> what day it was. In
/// Colombo that is 5.5 hours behind, so the service's day did not turn over at
/// midnight -- it turned over at 05:30. Between those two times a collector
/// opening the app still saw yesterday's round as "today", and the stops for
/// the morning they had just started sat under "Upcoming".
///
/// This is the one place that answers the question, so the round, the upcoming
/// list, the routing options and the resident's "has my day passed yet" all
/// turn over together.
/// </remarks>
public static class ServiceClock
{
    /// <summary>
    /// The timezone the service runs in. Collections are a local activity --
    /// a crew's Tuesday is the Tuesday outside their window.
    /// </summary>
    /// <remarks>
    /// Resolved once. The IANA id works on Linux and, since .NET 6, on Windows
    /// too; the Windows id is the fallback for a runtime built without ICU.
    /// </remarks>
    private static readonly TimeZoneInfo Zone = ResolveZone();

    private static TimeZoneInfo ResolveZone()
    {
        foreach (var id in new[] { "Asia/Colombo", "Sri Lanka Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }

        // Rather than fall back to UTC silently, which is the bug this type
        // exists to fix, use the fixed offset. Sri Lanka has no daylight saving,
        // so +05:30 is correct all year.
        return TimeZoneInfo.CreateCustomTimeZone(
            "EcoCycle/Colombo", TimeSpan.FromMinutes(330), "Colombo", "Colombo");
    }

    /// <summary>The current moment in the service's timezone.</summary>
    public static DateTime Now => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Zone);

    /// <summary>
    /// Today's calendar date, as midnight UTC.
    /// </summary>
    /// <remarks>
    /// Kind is UTC on purpose, and the clock part is zero. Scheduled dates are
    /// stored the same way, so the two compare directly -- and Npgsql rejects a
    /// DateTime that is not UTC for a <c>timestamp with time zone</c> column.
    /// </remarks>
    public static DateTime Today => DateTime.SpecifyKind(Now.Date, DateTimeKind.Utc);

    /// <summary>
    /// The latest time of day a pickup can still be booked onto today's round.
    /// </summary>
    /// <remarks>
    /// Crews are out from 8:30 am to 4:00 pm. A request that arrives by noon can
    /// still be reached the same day; one that arrives later goes on tomorrow's
    /// round at the earliest. The web and mobile date pickers use the same hour
    /// (SAME_DAY_CUTOFF_HOUR in frontend/src/lib/serviceDay.js and
    /// sameDayCutoffHour in mobile/lib/services/service_day.dart).
    /// </remarks>
    public static readonly TimeSpan SameDayCutoff = new(12, 0, 0);

    /// <summary>
    /// How many days from today the earliest bookable round is: 0 while today's
    /// round can still take work, 1 once the cut-off has passed.
    /// </summary>
    public static int EarliestBookingOffset => EarliestBookingOffsetAt(Now.TimeOfDay);

    /// <summary>The same rule for a given time of day, so it can be tested.</summary>
    public static int EarliestBookingOffsetAt(TimeSpan timeOfDay)
        => timeOfDay < SameDayCutoff ? 0 : 1;

    /// <summary>
    /// The calendar day a moment falls on for the service, as midnight UTC.
    /// </summary>
    /// <remarks>
    /// Clients send a pickup's day in two shapes. The web sends midnight UTC of
    /// the chosen date. Older mobile builds send the phone's local midnight
    /// converted to UTC, which in Colombo is 18:30 on the day before. Taking
    /// the UTC date of that second shape gives the wrong day, a day early.
    /// Reading the moment in the service's timezone gives the chosen day for
    /// both: 00:00 UTC is 05:30 that morning, and 18:30 UTC is midnight the
    /// next day.
    /// </remarks>
    public static DateTime DayOf(DateTime moment)
    {
        var utc = moment.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(moment, DateTimeKind.Utc)
            : moment.ToUniversalTime();
        var local = TimeZoneInfo.ConvertTimeFromUtc(utc, Zone);
        return DateTime.SpecifyKind(local.Date, DateTimeKind.Utc);
    }

    /// <summary>Today plus <paramref name="days"/>, as midnight UTC.</summary>
    public static DateTime TodayPlus(int days) => Today.AddDays(days);

    /// <summary>
    /// Reads a date the caller supplied (a query string, a form) as a calendar
    /// day in the service's timezone.
    /// </summary>
    public static DateTime AsServiceDay(DateTime value)
        => DateTime.SpecifyKind(value.Date, DateTimeKind.Utc);
}
