using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;

namespace backend.Tests.Services;

// Marking a stop complete closes the pickup and pays the resident in one save.
public class RouteCompletionTests
{
    private readonly ApplicationDbContext _db = new(
        new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private RouteAssignmentService Service => new(_db, new RewardService(_db));

    private (PickupRequest pickup, RouteAssignment route) AddScheduledStop(WasteCategory category)
    {
        var pickup = new PickupRequest
        {
            ResidentId = Guid.NewGuid(),
            PreferredDate = DateTime.UtcNow,
            Status = PickupStatus.Scheduled
        };
        var route = new RouteAssignment
        {
            PickupRequestId = pickup.Id,
            CollectorId = Guid.NewGuid(),
            ZoneId = Guid.NewGuid(),
            ScheduledDate = DateTime.UtcNow
        };
        _db.PickupRequests.Add(pickup);
        _db.RouteAssignments.Add(route);
        _db.WasteClassifications.Add(new WasteClassification
        {
            PickupRequestId = pickup.Id,
            Category = category,
            Confidence = 1.0,
            Reasoning = "test"
        });
        _db.SaveChanges();
        return (pickup, route);
    }

    [Fact]
    public async Task Completing_a_stop_marks_the_pickup_completed_and_awards_points()
    {
        var (pickup, route) = AddScheduledStop(WasteCategory.Recyclable);

        var result = await Service.MarkCompleteAsync(route.Id);

        Assert.NotNull(result);
        Assert.Equal(PickupStatus.Completed, (await _db.PickupRequests.FindAsync(pickup.Id))!.Status);
        var reward = await _db.RewardPoints.SingleAsync();
        Assert.Equal(5, reward.PointsEarned);
        Assert.Equal(pickup.ResidentId, reward.ResidentId);
    }

    [Fact]
    public async Task Completing_the_same_stop_twice_awards_once()
    {
        var (_, route) = AddScheduledStop(WasteCategory.Organic);

        await Service.MarkCompleteAsync(route.Id);
        await Service.MarkCompleteAsync(route.Id);

        Assert.Equal(1, await _db.RewardPoints.CountAsync());
    }

    [Fact]
    public async Task Unknown_stop_returns_null_and_awards_nothing()
    {
        Assert.Null(await Service.MarkCompleteAsync(Guid.NewGuid()));
        Assert.Equal(0, await _db.RewardPoints.CountAsync());
    }
}
