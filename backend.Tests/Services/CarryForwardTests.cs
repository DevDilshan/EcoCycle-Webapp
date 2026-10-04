using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;

namespace backend.Tests.Services;

// A pending stop is carried onto today's round for a week, then handed to an
// admin instead. The boundary is the whole point: a day either side decides
// whether a stop appears in front of a collector or in the overdue queue, and
// getting it wrong is silent -- the round simply shows the wrong work.
public class CarryForwardTests
{
    private readonly ApplicationDbContext _db = new(
        new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private RouteAssignmentService Service => new(_db, new RewardService(_db));

    private readonly Guid _collector = Guid.NewGuid();

    // The resident and the zone are written too, not just their ids. Resident and
    // Zone are required relationships, so the Include on these queries is an
    // INNER JOIN -- a stop whose profile or zone row is absent does not come back
    // at all. The database's foreign keys make that impossible in practice, but
    // an in-memory fixture will happily hold a dangling id and then silently
    // return nothing, which reads as a broken query rather than bad test data.
    private Guid AddStop(int daysAgo, RouteCompletionStatus status = RouteCompletionStatus.Pending)
    {
        var resident = new Profile
        {
            Id = Guid.NewGuid(),
            Email = $"resident-{Guid.NewGuid():N}@example.test",
            FullName = "Test Resident",
            Role = "resident"
        };
        var zone = new Zone { Id = Guid.NewGuid(), Name = "Test Zone" };
        var pickup = new PickupRequest
        {
            ResidentId = resident.Id,
            PreferredDate = DateTime.UtcNow,
            Status = PickupStatus.Scheduled
        };
        var route = new RouteAssignment
        {
            PickupRequestId = pickup.Id,
            CollectorId = _collector,
            ZoneId = zone.Id,
            ScheduledDate = ServiceClock.TodayPlus(-daysAgo),
            CompletionStatus = status
        };
        _db.Profiles.Add(resident);
        _db.Zones.Add(zone);
        _db.PickupRequests.Add(pickup);
        _db.RouteAssignments.Add(route);
        _db.SaveChanges();
        return route.Id;
    }

    [Fact]
    public async Task Todays_round_carries_a_pending_stop_from_within_the_window()
    {
        var yesterday = AddStop(1);

        var round = await Service.GetTodayRouteForCollectorAsync(_collector);

        Assert.Contains(yesterday, round.Select(r => r.Id));
    }

    [Fact]
    public async Task Todays_round_keeps_a_stop_exactly_on_the_boundary()
    {
        // Seven days back is still carried: the cap is ">= today minus seven",
        // and an off-by-one here would drop a stop a collector could still reach.
        var onTheEdge = AddStop(RouteAssignmentService.CarryForwardDays);

        var round = await Service.GetTodayRouteForCollectorAsync(_collector);

        Assert.Contains(onTheEdge, round.Select(r => r.Id));
    }

    [Fact]
    public async Task Todays_round_drops_a_stop_past_the_window()
    {
        var tooOld = AddStop(RouteAssignmentService.CarryForwardDays + 1);

        var round = await Service.GetTodayRouteForCollectorAsync(_collector);

        Assert.DoesNotContain(tooOld, round.Select(r => r.Id));
    }

    [Fact]
    public async Task A_stop_that_drops_off_the_round_lands_in_the_overdue_queue()
    {
        // The pair that matters. Nothing may vanish: a stop leaving the round
        // has to arrive somewhere a person can still act on it.
        var tooOld = AddStop(RouteAssignmentService.CarryForwardDays + 1);

        var round = await Service.GetTodayRouteForCollectorAsync(_collector);
        var overdue = await Service.GetOverdueStopsAsync();

        Assert.DoesNotContain(tooOld, round.Select(r => r.Id));
        Assert.Contains(tooOld, overdue.Select(r => r.Id));
    }

    [Fact]
    public async Task Overdue_excludes_stops_still_on_the_round()
    {
        var recent = AddStop(1);

        var overdue = await Service.GetOverdueStopsAsync();

        Assert.DoesNotContain(recent, overdue.Select(r => r.Id));
    }

    [Fact]
    public async Task Overdue_excludes_resolved_stops_however_old()
    {
        // Completed and missed are finished with. An old one must not reappear
        // as a queue item an admin has to dismiss again.
        var done = AddStop(60, RouteCompletionStatus.Completed);
        var missed = AddStop(60, RouteCompletionStatus.Missed);

        var overdue = await Service.GetOverdueStopsAsync();

        Assert.DoesNotContain(done, overdue.Select(r => r.Id));
        Assert.DoesNotContain(missed, overdue.Select(r => r.Id));
    }

    [Fact]
    public async Task Overdue_is_oldest_first()
    {
        // A queue to be emptied, and the longest wait is what a resident rings
        // about, so it has to be at the top.
        AddStop(30);
        AddStop(60);

        var overdue = await Service.GetOverdueStopsAsync();

        Assert.Equal(
            overdue.Select(r => r.ScheduledDate).OrderBy(d => d),
            overdue.Select(r => r.ScheduledDate));
    }
}
