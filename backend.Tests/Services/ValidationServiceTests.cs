using backend.Data;
using backend.Models;
using backend.Services;
using backend.Services.Rules;
using Microsoft.EntityFrameworkCore;

namespace backend.Tests.Services;

// Runs the real service against an in-memory database seeded with fake pickups.
public class ValidationServiceTests
{
    private static readonly DateTime Now = DateTime.UtcNow;
    private static readonly DateTime StartOfThisMonth =
        new(Now.Year, Now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

    private readonly ApplicationDbContext _db = new(
        new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private readonly Guid _resident = Guid.NewGuid();

    private ValidationService Service => new(_db);

    // Adds a pickup plus one classification per category, oldest first.
    private PickupRequest AddPickup(Guid residentId, DateTime createdAt, params WasteCategory[] categories)
    {
        var pickup = new PickupRequest
        {
            ResidentId = residentId,
            PreferredDate = createdAt.AddDays(1),
            Status = PickupStatus.Scheduled,
            CreatedAt = createdAt
        };
        _db.PickupRequests.Add(pickup);

        for (var i = 0; i < categories.Length; i++)
        {
            _db.WasteClassifications.Add(new WasteClassification
            {
                PickupRequestId = pickup.Id,
                Category = categories[i],
                Confidence = 1.0,
                Reasoning = "Fake classification for tests",
                CreatedAt = createdAt.AddMinutes(i + 1)
            });
        }

        _db.SaveChanges();
        return pickup;
    }

    [Fact]
    public async Task Unknown_pickup_returns_null()
    {
        Assert.Null(await Service.ValidateAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task Unclassified_pickup_cannot_be_validated()
    {
        var pickup = AddPickup(_resident, StartOfThisMonth.AddMinutes(10));

        await Assert.ThrowsAsync<InvalidOperationException>(() => Service.ValidateAsync(pickup.Id));
    }

    [Fact]
    public async Task Hazardous_pickup_is_flagged_with_its_id()
    {
        var pickup = AddPickup(_resident, StartOfThisMonth.AddMinutes(10), WasteCategory.Hazardous);

        var result = await Service.ValidateAsync(pickup.Id);

        Assert.NotNull(result);
        Assert.Equal(pickup.Id, result.PickupRequestId);
        Assert.Equal(new[] { RewardRules.HazardousCategory }, result.ViolatedRules);
    }

    [Fact]
    public async Task Second_bulk_pickup_this_month_is_flagged()
    {
        AddPickup(_resident, StartOfThisMonth.AddMinutes(10), RewardRules.BulkCategory);
        var current = AddPickup(_resident, StartOfThisMonth.AddMinutes(20), RewardRules.BulkCategory);

        var result = await Service.ValidateAsync(current.Id);

        Assert.Equal(new[] { RewardRules.ExcessiveBulkPickups }, result!.ViolatedRules);
    }

    [Fact]
    public async Task Bulk_pickup_from_last_month_does_not_count()
    {
        AddPickup(_resident, StartOfThisMonth.AddDays(-3), RewardRules.BulkCategory);
        var current = AddPickup(_resident, StartOfThisMonth.AddMinutes(20), RewardRules.BulkCategory);

        var result = await Service.ValidateAsync(current.Id);

        Assert.True(result!.IsValid);
    }

    [Fact]
    public async Task Another_residents_bulk_pickups_do_not_count()
    {
        AddPickup(Guid.NewGuid(), StartOfThisMonth.AddMinutes(10), RewardRules.BulkCategory);
        var current = AddPickup(_resident, StartOfThisMonth.AddMinutes(20), RewardRules.BulkCategory);

        var result = await Service.ValidateAsync(current.Id);

        Assert.True(result!.IsValid);
    }

    [Fact]
    public async Task Pickup_classified_twice_counts_as_one_bulk_pickup()
    {
        var current = AddPickup(_resident, StartOfThisMonth.AddMinutes(20),
            RewardRules.BulkCategory, RewardRules.BulkCategory);

        var result = await Service.ValidateAsync(current.Id);

        Assert.True(result!.IsValid);
    }

    [Fact]
    public async Task Newest_classification_is_the_one_checked()
    {
        var current = AddPickup(_resident, StartOfThisMonth.AddMinutes(20),
            WasteCategory.Hazardous, WasteCategory.Recyclable);

        var result = await Service.ValidateAsync(current.Id);

        Assert.True(result!.IsValid);
    }
}
