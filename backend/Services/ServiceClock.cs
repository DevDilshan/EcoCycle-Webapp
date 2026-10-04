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

    /// <summary>Today plus <paramref name="days"/>, as midnight UTC.</summary>
    public static DateTime TodayPlus(int days) => Today.AddDays(days);

    /// <summary>
    /// Reads a date the caller supplied (a query string, a form) as a calendar
    /// day in the service's timezone.
    /// </summary>
    public static DateTime AsServiceDay(DateTime value)
        => DateTime.SpecifyKind(value.Date, DateTimeKind.Utc);
}
