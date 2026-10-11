using backend.Services;

namespace backend.Tests.Services;

public class ServiceClockTests
{
    [Theory]
    [InlineData(0, 0, 0)]     // just after midnight: today's round is still ahead
    [InlineData(8, 30, 0)]    // crews setting out
    [InlineData(11, 59, 0)]   // the last minute before the cut-off
    [InlineData(12, 0, 1)]    // noon exactly: tomorrow at the earliest
    [InlineData(16, 0, 1)]    // round finished
    [InlineData(23, 59, 1)]
    public void Today_can_be_booked_until_the_same_day_cut_off(int hour, int minute, int expectedOffset)
    {
        Assert.Equal(expectedOffset, ServiceClock.EarliestBookingOffsetAt(new TimeSpan(hour, minute, 0)));
    }

    [Fact]
    public void Today_is_a_calendar_day_at_midnight_utc()
    {
        var today = ServiceClock.Today;

        Assert.Equal(DateTimeKind.Utc, today.Kind);
        Assert.Equal(TimeSpan.Zero, today.TimeOfDay);
        Assert.Equal(today.AddDays(3), ServiceClock.TodayPlus(3));
    }

    [Fact]
    public void A_pickup_for_today_is_accepted_and_one_for_yesterday_is_not()
    {
        var today = backend.Validation.PickupRequestValidation.Validate("plastic bottles", ServiceClock.Today, false, null);
        var yesterday = backend.Validation.PickupRequestValidation.Validate("plastic bottles", ServiceClock.TodayPlus(-1), false, null);

        Assert.Empty(today);
        Assert.Contains(yesterday, r => r.ErrorMessage!.Contains("in the past"));
    }

    [Theory]
    // The web and current mobile app: midnight UTC of the chosen day.
    [InlineData("2026-10-12T00:00:00Z", 12)]
    // Older mobile builds: Colombo's local midnight on the 12th, sent as UTC.
    [InlineData("2026-10-11T18:30:00Z", 12)]
    // Any time during the Colombo day is still that day.
    [InlineData("2026-10-12T18:29:00Z", 12)]
    [InlineData("2026-10-12T18:30:00Z", 13)]
    public void DayOf_reads_a_moment_as_the_day_it_is_in_Colombo(string moment, int expectedDay)
    {
        var parsed = DateTime.Parse(moment, null, System.Globalization.DateTimeStyles.RoundtripKind);

        var day = ServiceClock.DayOf(parsed);

        Assert.Equal(new DateTime(2026, 10, expectedDay, 0, 0, 0, DateTimeKind.Utc), day);
        Assert.Equal(DateTimeKind.Utc, day.Kind);
    }

    [Fact]
    public void DayOf_treats_a_date_with_no_timezone_as_that_date()
    {
        var day = ServiceClock.DayOf(new DateTime(2026, 10, 12));

        Assert.Equal(new DateTime(2026, 10, 12, 0, 0, 0, DateTimeKind.Utc), day);
    }

    [Fact]
    public void A_pickup_for_today_from_an_older_mobile_build_is_not_refused_as_past()
    {
        // Today's local midnight in Colombo, as an older build would send it.
        var asOldMobileSendsIt = ServiceClock.Today.AddHours(-5.5);

        var errors = backend.Validation.PickupRequestValidation.Validate("plastic bottles", asOldMobileSendsIt, false, null);

        Assert.Empty(errors);
    }
}
