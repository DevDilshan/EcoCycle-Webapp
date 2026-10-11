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
}
