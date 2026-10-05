using backend.Data;
using backend.DTOs;
using backend.Models;
using backend.Services;
using backend.Validation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace backend.Tests.Services;

public class RouteLocationTests
{
    [Fact]
    public async Task Saved_pin_survives_reads_and_edits_but_is_cleared_when_address_changes()
    {
        using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var zone = new Zone { Name = "Colombo", IsActive = true };
        db.Add(zone); await db.SaveChangesAsync();
        // These create/update operations do not run agents or schedule routes.
        var service = new PickupRequestService(db, null!, null!, null!, NullLogger<PickupRequestService>.Instance);
        var resident = Guid.NewGuid();
        var created = await service.CreateAsync(resident, new CreatePickupRequestDto {
            ZoneId = zone.Id, Address = "14 Park Road", ContactPhone = "0771234567", Description = "Cardboard",
            PreferredDate = ServiceClock.TodayPlus(1), Latitude = 6.91, Longitude = 79.87 });
        Assert.Equal(6.91, created.Latitude);
        db.ChangeTracker.Clear();
        var read = await service.GetByIdAsync(created.Id, resident, false);
        Assert.Equal(79.87, read!.Longitude);
        var edit = new UpdatePickupRequestDto { Description = "Cardboard", PreferredDate = created.PreferredDate };
        var unchanged = await service.UpdateAsync(created.Id, resident, false, edit);
        Assert.Equal(6.91, unchanged!.Latitude);
        edit.Address = "21 New Street";
        var moved = await service.UpdateAsync(created.Id, resident, false, edit);
        Assert.Equal(edit.Address, moved!.Address);
        Assert.Null(moved.Latitude);
        Assert.Null(moved.Longitude);
        edit.Latitude = 6.92; edit.Longitude = 79.88;
        await service.UpdateAsync(created.Id, resident, false, edit);
        edit.ClearLocation = true;
        var removed = await service.UpdateAsync(created.Id, resident, false, edit);
        Assert.Null(removed!.Latitude);
        Assert.Null(removed.Longitude);
    }

    [Fact]
    public async Task Next_recurring_booking_keeps_its_address_and_pin()
    {
        using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var pickup = new PickupRequest { Address = "14 Park Road", ContactPhone = "0771234567", Latitude = 6.91, Longitude = 79.87,
            IsRecurring = true, RecurrenceInterval = "Weekly", Status = PickupStatus.Scheduled };
        var route = new RouteAssignment { PickupRequestId = pickup.Id };
        db.AddRange(pickup, route); await db.SaveChangesAsync();
        var service = new RouteAssignmentService(db, new RewardService(db));
        await service.MarkCompleteAsync(route.Id);
        var next = await db.PickupRequests.SingleAsync(p => p.Id == service.NextRecurringPickupId);
        Assert.Equal(pickup.Address, next.Address);
        Assert.Equal(pickup.ContactPhone, next.ContactPhone);
        Assert.Equal(pickup.Latitude, next.Latitude);
        Assert.Equal(pickup.Longitude, next.Longitude);
    }
    [Theory]
    [InlineData(null, null, true)]
    [InlineData(0.0, 0.0, true)]
    [InlineData(6.91, 79.86, true)]
    [InlineData(6.91, null, false)]
    [InlineData(null, 79.86, false)]
    [InlineData(91.0, 79.86, false)]
    [InlineData(6.91, -181.0, false)]
    public void Coordinates_are_optional_but_must_be_a_valid_pair(double? lat, double? lng, bool valid)
        => Assert.Equal(valid, !PickupLocationValidation.Validate(lat, lng).Any());

    [Fact]
    public async Task Assigned_round_contains_pickup_location_even_without_a_paged_pickup_list()
    {
        using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var zone = new Zone { Name = "Colombo", Latitude = 6.92, Longitude = 79.86 };
        var resident = new Profile { Id = Guid.NewGuid(), Role = "resident", Email = "resident@example.test" };
        var pickup = new PickupRequest { Address = "14 Park Road", ContactPhone = "0771234567", Description = "Cardboard",
            Latitude = 6.91, Longitude = 79.87, ZoneId = zone.Id, ResidentId = resident.Id };
        var collector = Guid.NewGuid();
        var route = new RouteAssignment { PickupRequestId = pickup.Id, ZoneId = zone.Id,
            CollectorId = collector, ScheduledDate = ServiceClock.Today };
        db.AddRange(resident, zone, pickup, route);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var service = new RouteAssignmentService(db, new RewardService(db));
        var stop = Assert.Single(await service.GetTodayRouteForCollectorAsync(collector));
        Assert.Equal(route.Id, stop.Id);
        Assert.Equal(pickup.Address, stop.Pickup!.Address);
        Assert.Equal(pickup.Address, stop.Address);
        Assert.Equal(pickup.ContactPhone, stop.ResidentPhone);
        Assert.Equal(pickup.Latitude, stop.Latitude);
        Assert.Equal(pickup.Latitude, stop.Pickup.Latitude);
        Assert.Equal(pickup.Longitude, stop.Pickup.Longitude);
        Assert.Equal(zone.Name, stop.Pickup.ZoneName);

        // Zone centers must never stand in for an individual home's location.
        pickup.Latitude = null; pickup.Longitude = null;
        db.Update(pickup); await db.SaveChangesAsync(); db.ChangeTracker.Clear();
        var legacy = Assert.Single(await service.GetTodayRouteForCollectorAsync(collector));
        Assert.Null(legacy.Pickup!.Latitude);
        Assert.Null(legacy.Pickup.Longitude);
    }
}
