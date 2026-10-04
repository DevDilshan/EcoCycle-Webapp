using backend.Data;
using backend.DTOs;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;

namespace backend.Tests.Services;

// Booking and moving stops. Every check here guards something the database
// cannot: a profile id is a valid foreign key whatever role it has, so nothing
// but these refuses a round assigned to a resident.
public class RouteValidationTests
{
    private readonly ApplicationDbContext _db = new(
        new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private RouteAssignmentService Service => new(_db, new RewardService(_db));

    private Profile AddProfile(string role)
    {
        var profile = new Profile
        {
            Id = Guid.NewGuid(),
            Email = $"{role}-{Guid.NewGuid():N}@example.test",
            FullName = $"Test {role}",
            Role = role
        };
        _db.Profiles.Add(profile);
        _db.SaveChanges();
        return profile;
    }

    private Zone AddZone(bool active = true)
    {
        var zone = new Zone { Id = Guid.NewGuid(), Name = $"Zone {Guid.NewGuid():N}", IsActive = active };
        _db.Zones.Add(zone);
        _db.SaveChanges();
        return zone;
    }

    private PickupRequest AddPickup(Guid residentId)
    {
        var pickup = new PickupRequest
        {
            ResidentId = residentId,
            PreferredDate = DateTime.UtcNow,
            Status = PickupStatus.Approved
        };
        _db.PickupRequests.Add(pickup);
        _db.SaveChanges();
        return pickup;
    }

    private CreateRouteAssignmentDto Dto(Guid pickupId, Guid collectorId, Guid zoneId) => new()
    {
        PickupRequestId = pickupId,
        CollectorId = collectorId,
        ZoneId = zoneId,
        ScheduledDate = ServiceClock.Today
    };

    [Fact]
    public async Task A_valid_booking_is_accepted()
    {
        var resident = AddProfile("resident");
        var collector = AddProfile("collector");
        var zone = AddZone();
        var pickup = AddPickup(resident.Id);

        var route = await Service.CreateAsync(Dto(pickup.Id, collector.Id, zone.Id));

        Assert.Equal(collector.Id, route.CollectorId);
    }

    [Fact]
    public async Task A_stop_cannot_be_assigned_to_a_resident()
    {
        // The case the database cannot catch: a resident's id is a perfectly good
        // foreign key, and the round then appears on no collector's screen.
        var resident = AddProfile("resident");
        var zone = AddZone();
        var pickup = AddPickup(resident.Id);

        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => Service.CreateAsync(Dto(pickup.Id, resident.Id, zone.Id)));

        Assert.Contains("only be assigned to a collector", ex.Message);
    }

    [Fact]
    public async Task A_stop_cannot_be_booked_against_a_missing_pickup()
    {
        var collector = AddProfile("collector");
        var zone = AddZone();

        await Assert.ThrowsAsync<ArgumentException>(
            () => Service.CreateAsync(Dto(Guid.NewGuid(), collector.Id, zone.Id)));
    }

    [Fact]
    public async Task A_stop_cannot_be_booked_in_a_retired_zone()
    {
        var resident = AddProfile("resident");
        var collector = AddProfile("collector");
        var retired = AddZone(active: false);
        var pickup = AddPickup(resident.Id);

        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => Service.CreateAsync(Dto(pickup.Id, collector.Id, retired.Id)));

        Assert.Contains("retired", ex.Message);
    }

    [Fact]
    public async Task A_pickup_cannot_be_booked_onto_two_rounds_at_once()
    {
        // Two pending stops for one pickup put the same collection on the round
        // twice, and completing one leaves the other carried forward for ever as
        // work that was in fact done.
        var resident = AddProfile("resident");
        var collector = AddProfile("collector");
        var zone = AddZone();
        var pickup = AddPickup(resident.Id);

        await Service.CreateAsync(Dto(pickup.Id, collector.Id, zone.Id));

        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => Service.CreateAsync(Dto(pickup.Id, collector.Id, zone.Id)));

        Assert.Contains("already on a round", ex.Message);
    }

    [Fact]
    public async Task The_one_click_assign_also_refuses_a_second_round()
    {
        // The Assign button on the pickups list is one click, so clicking it twice
        // is the easiest way in the whole app to double-book a collection.
        var resident = AddProfile("resident");
        var collector = AddProfile("collector");
        var zone = AddZone();
        zone.AssignedCollectorId = collector.Id;
        await _db.SaveChangesAsync();

        var pickup = AddPickup(resident.Id);
        pickup.ZoneId = zone.Id;
        await _db.SaveChangesAsync();

        await Service.AssignPickupToRouteAsync(pickup.Id);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => Service.AssignPickupToRouteAsync(pickup.Id));

        Assert.Contains("already on a round", ex.Message);
    }

    [Fact]
    public async Task Reassigning_to_a_resident_is_refused()
    {
        var resident = AddProfile("resident");
        var collector = AddProfile("collector");
        var zone = AddZone();
        var pickup = AddPickup(resident.Id);
        var route = await Service.CreateAsync(Dto(pickup.Id, collector.Id, zone.Id));

        await Assert.ThrowsAsync<ArgumentException>(
            () => Service.ReassignAsync(route.Id, resident.Id));
    }

    [Fact]
    public async Task A_completed_stop_cannot_be_reassigned()
    {
        // Moving a finished stop rewrites who is recorded as having collected it,
        // which is a falsified record rather than a plan.
        var resident = AddProfile("resident");
        var collector = AddProfile("collector");
        var other = AddProfile("collector");
        var zone = AddZone();
        var pickup = AddPickup(resident.Id);
        var route = await Service.CreateAsync(Dto(pickup.Id, collector.Id, zone.Id));

        var stored = await _db.RouteAssignments.FirstAsync(r => r.Id == route.Id);
        stored.CompletionStatus = RouteCompletionStatus.Completed;
        await _db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => Service.ReassignAsync(route.Id, other.Id));

        Assert.Contains("cannot be reassigned", ex.Message);
    }

    [Fact]
    public async Task Reassigning_to_the_same_collector_is_refused()
    {
        var resident = AddProfile("resident");
        var collector = AddProfile("collector");
        var zone = AddZone();
        var pickup = AddPickup(resident.Id);
        var route = await Service.CreateAsync(Dto(pickup.Id, collector.Id, zone.Id));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => Service.ReassignAsync(route.Id, collector.Id));
    }

    [Fact]
    public async Task Marking_missed_without_a_reason_is_refused()
    {
        // Both UIs ask for one, but only the server can insist -- and the Notifier
        // agent writes the resident's explanation from this field.
        var resident = AddProfile("resident");
        var collector = AddProfile("collector");
        var zone = AddZone();
        var pickup = AddPickup(resident.Id);
        var route = await Service.CreateAsync(Dto(pickup.Id, collector.Id, zone.Id));

        await Assert.ThrowsAsync<ArgumentException>(
            () => Service.MarkMissedAsync(route.Id, "   "));
    }

    [Fact]
    public async Task Marking_missed_with_a_reason_records_it_trimmed()
    {
        var resident = AddProfile("resident");
        var collector = AddProfile("collector");
        var zone = AddZone();
        var pickup = AddPickup(resident.Id);
        var route = await Service.CreateAsync(Dto(pickup.Id, collector.Id, zone.Id));

        var updated = await Service.MarkMissedAsync(route.Id, "  Nothing was out  ");

        Assert.Equal("Nothing was out", updated!.IssueNotes);
    }
}
