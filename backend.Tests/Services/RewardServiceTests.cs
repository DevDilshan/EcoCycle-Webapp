using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;

namespace backend.Tests.Services;

// Runs the real services against an in-memory database.
public class RewardServiceTests
{
    private readonly ApplicationDbContext _db = new(
        new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private readonly Guid _resident = Guid.NewGuid();

    private RewardService Rewards => new(_db);

    private PickupRequest AddPickup(WasteCategory? category, Guid? residentId = null)
    {
        var pickup = new PickupRequest
        {
            ResidentId = residentId ?? _resident,
            PreferredDate = DateTime.UtcNow,
            Status = PickupStatus.Scheduled
        };
        _db.PickupRequests.Add(pickup);
        if (category is not null)
        {
            _db.WasteClassifications.Add(new WasteClassification
            {
                PickupRequestId = pickup.Id,
                Category = category.Value,
                Confidence = 1.0,
                Reasoning = "test"
            });
        }
        _db.SaveChanges();
        return pickup;
    }

    private void AddViolations(int count)
    {
        for (var i = 0; i < count; i++)
        {
            var other = AddPickup(WasteCategory.General);
            _db.ComplianceViolations.Add(new ComplianceViolation
            {
                ResidentId = _resident,
                PickupRequestId = other.Id,
                RuleViolated = "test violation"
            });
        }
        _db.SaveChanges();
    }

    [Fact]
    public async Task Completed_recyclable_pickup_stages_five_points()
    {
        var pickup = AddPickup(WasteCategory.Recyclable);

        var reward = await Rewards.StageCompletionAwardAsync(pickup.Id);
        await _db.SaveChangesAsync();

        Assert.NotNull(reward);
        Assert.Equal(5, reward!.PointsEarned);
        Assert.Equal(_resident, reward.ResidentId);
        Assert.Equal(1, await _db.RewardPoints.CountAsync());
    }

    [Fact]
    public async Task Staging_alone_does_not_save()
    {
        var pickup = AddPickup(WasteCategory.Organic);

        await Rewards.StageCompletionAwardAsync(pickup.Id);

        // Nothing committed until the caller saves.
        Assert.Equal(EntityState.Added, _db.ChangeTracker.Entries<RewardPoint>().Single().State);
    }

    [Fact]
    public async Task Completing_the_same_pickup_twice_pays_once()
    {
        var pickup = AddPickup(WasteCategory.Recyclable);

        await Rewards.StageCompletionAwardAsync(pickup.Id);
        await _db.SaveChangesAsync();
        var second = await Rewards.StageCompletionAwardAsync(pickup.Id);
        await _db.SaveChangesAsync();

        Assert.Null(second);
        Assert.Equal(1, await _db.RewardPoints.CountAsync());
    }

    [Fact]
    public async Task Unclassified_pickup_earns_nothing()
    {
        var pickup = AddPickup(category: null);

        Assert.Null(await Rewards.StageCompletionAwardAsync(pickup.Id));
    }

    [Fact]
    public async Task Unknown_pickup_earns_nothing() =>
        Assert.Null(await Rewards.StageCompletionAwardAsync(Guid.NewGuid()));

    [Fact]
    public async Task Resident_with_three_past_violations_earns_reduced_points()
    {
        AddViolations(3);
        var pickup = AddPickup(WasteCategory.Recyclable);

        var reward = await Rewards.StageCompletionAwardAsync(pickup.Id);

        Assert.Equal(2, reward!.PointsEarned);
        Assert.Contains("reduced", reward.Reason);
    }

    [Fact]
    public async Task This_pickups_own_violation_is_not_counted_against_it()
    {
        AddViolations(2);
        var pickup = AddPickup(WasteCategory.Recyclable);
        _db.ComplianceViolations.Add(new ComplianceViolation
        {
            ResidentId = _resident,
            PickupRequestId = pickup.Id,
            RuleViolated = "own violation"
        });
        await _db.SaveChangesAsync();

        var reward = await Rewards.StageCompletionAwardAsync(pickup.Id);

        Assert.Equal(5, reward!.PointsEarned);
    }

    [Fact]
    public async Task Leaderboard_ranks_by_points_and_ignores_redemptions()
    {
        var low = Guid.NewGuid();
        var high = Guid.NewGuid();
        _db.Profiles.AddRange(
            new Profile { Id = low, Email = "low@test.com", FullName = "Low", Role = "resident" },
            new Profile { Id = high, Email = "high@test.com", FullName = "High", Role = "resident" });
        _db.RewardPoints.AddRange(
            new RewardPoint { ResidentId = low, PointsEarned = 3, Reason = "a" },
            new RewardPoint { ResidentId = high, PointsEarned = 10, Reason = "b" },
            new RewardPoint { ResidentId = high, PointsEarned = -9, Reason = "redeemed" });
        await _db.SaveChangesAsync();

        var board = await Rewards.GetLeaderboardAsync(10);

        Assert.Equal(new[] { "High", "Low" }, board.Select(e => e.ResidentName));
        Assert.Equal(10, board[0].PointsEarned);
    }
}
