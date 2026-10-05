using backend.Data;
using backend.DTOs;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;

namespace backend.Tests.Services;

// Service-layer dispatch rules beyond RouteCompletionTests (booking constraints).
public class RouteAssignmentServiceTests
{
    private readonly ApplicationDbContext _db = new(
        new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private readonly Guid _collector = Guid.NewGuid();
    private readonly Guid _zoneId = Guid.NewGuid();

    private RouteAssignmentService Service => new(_db, new RewardService(_db));

    public RouteAssignmentServiceTests()
    {
        _db.Profiles.Add(new Profile
        {
            Id = _collector,
            Email = "col@test.local",
            Role = "collector",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        _db.Zones.Add(new Zone { Id = _zoneId, Name = "Zone A", Description = "d", IsActive = true });
        _db.SaveChanges();
    }

    private PickupRequest AddPickup(PickupStatus status = PickupStatus.Classified)
    {
        var pickup = new PickupRequest
        {
            Description = "Bags of recyclables",
            PreferredDate = DateTime.UtcNow.AddDays(2),
            Status = status,
        };
        _db.PickupRequests.Add(pickup);
        _db.SaveChanges();
        return pickup;
    }

    private static CreateRouteAssignmentDto ValidDto(Guid pickupId, Guid collectorId, Guid zoneId) => new()
    {
        PickupRequestId = pickupId,
        CollectorId = collectorId,
        ZoneId = zoneId,
        ScheduledDate = DateTime.UtcNow.Date,
    };

    [Fact]
    public async Task CreateAsync_marks_pickup_scheduled()
    {
        var pickup = AddPickup();

        await Service.CreateAsync(ValidDto(pickup.Id, _collector, _zoneId));

        Assert.Equal(PickupStatus.Scheduled, (await _db.PickupRequests.FindAsync(pickup.Id))!.Status);
    }

    [Fact]
    public async Task CreateAsync_rejects_non_collector_profile()
    {
        var residentId = Guid.NewGuid();
        _db.Profiles.Add(new Profile
        {
            Id = residentId,
            Email = "res@test.local",
            Role = "resident",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        var pickup = AddPickup();
        var dto = ValidDto(pickup.Id, residentId, _zoneId);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => Service.CreateAsync(dto));
        Assert.Contains("collector", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CreateAsync_rejects_second_pending_stop_for_same_pickup()
    {
        var pickup = AddPickup();
        await Service.CreateAsync(ValidDto(pickup.Id, _collector, _zoneId));

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            Service.CreateAsync(ValidDto(pickup.Id, _collector, _zoneId)));

        Assert.Contains("already on a round", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CreateAsync_rejects_retired_zone()
    {
        var retiredZone = Guid.NewGuid();
        _db.Zones.Add(new Zone { Id = retiredZone, Name = "Old", Description = "d", IsActive = false });
        await _db.SaveChangesAsync();

        var pickup = AddPickup();
        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            Service.CreateAsync(ValidDto(pickup.Id, _collector, retiredZone)));

        Assert.Contains("retired", ex.Message, StringComparison.OrdinalIgnoreCase);
    }
}
