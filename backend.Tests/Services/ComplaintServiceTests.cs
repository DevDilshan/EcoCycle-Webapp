using backend.Data;
using backend.DTOs;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;

namespace backend.Tests.Services;

public class ComplaintServiceTests
{
    private readonly ApplicationDbContext _db = new(
        new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private readonly Guid _resident = Guid.NewGuid();
    private readonly Guid _otherResident = Guid.NewGuid();

    private ComplaintService Service => new(_db);

    private PickupRequest AddPickup(Guid residentId)
    {
        var pickup = new PickupRequest
        {
            ResidentId = residentId,
            Description = "Test waste",
            PreferredDate = DateTime.UtcNow.AddDays(2),
            Status = PickupStatus.Classified,
        };
        _db.PickupRequests.Add(pickup);
        _db.SaveChanges();
        return pickup;
    }

    private static CreateComplaintDto ValidDto(Guid pickupId) => new()
    {
        PickupRequestId = pickupId,
        Description = "The crew missed my bags on the scheduled day.",
    };

    [Fact]
    public async Task CreateAsync_saves_open_complaint_for_residents_pickup()
    {
        var pickup = AddPickup(_resident);

        var created = await Service.CreateAsync(_resident, ValidDto(pickup.Id));

        Assert.Equal(_resident, created.ResidentId);
        Assert.Equal(pickup.Id, created.PickupRequestId);
        Assert.Equal(nameof(ComplaintStatus.Open), created.Status);
        Assert.Equal(ValidDto(pickup.Id).Description, created.Description);
    }

    [Fact]
    public async Task CreateAsync_rejects_description_shorter_than_10_characters()
    {
        var pickup = AddPickup(_resident);
        var dto = ValidDto(pickup.Id);
        dto.Description = "Too short";

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => Service.CreateAsync(_resident, dto));
        Assert.Contains("10 characters", ex.Message);
    }

    [Fact]
    public async Task CreateAsync_rejects_pickup_that_belongs_to_another_resident()
    {
        var pickup = AddPickup(_otherResident);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            Service.CreateAsync(_resident, ValidDto(pickup.Id)));
    }

    [Fact]
    public async Task CreateAsync_rejects_second_open_complaint_for_same_pickup()
    {
        var pickup = AddPickup(_resident);
        await Service.CreateAsync(_resident, ValidDto(pickup.Id));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Service.CreateAsync(_resident, ValidDto(pickup.Id)));
    }

    [Fact]
    public async Task CreateAsync_allows_new_complaint_after_previous_was_resolved()
    {
        var pickup = AddPickup(_resident);
        var first = await Service.CreateAsync(_resident, ValidDto(pickup.Id));

        await Service.UpdateAsync(first.Id, new UpdateComplaintDto
        {
            Status = ComplaintStatus.Resolved,
            AdminNotes = "Handled",
        });

        var second = await Service.CreateAsync(_resident, ValidDto(pickup.Id));
        Assert.NotEqual(first.Id, second.Id);
    }

    [Fact]
    public async Task GetListAsync_resident_sees_only_own_complaints()
    {
        var mine = AddPickup(_resident);
        var theirs = AddPickup(_otherResident);
        await Service.CreateAsync(_resident, ValidDto(mine.Id));
        await Service.CreateAsync(_otherResident, ValidDto(theirs.Id));

        var page = await Service.GetListAsync(_resident, isAdmin: false, new ComplaintQueryParams());

        var item = Assert.Single(page.Items);
        Assert.Equal(_resident, item.ResidentId);
    }

    [Fact]
    public async Task GetListAsync_admin_sees_everyones_complaints()
    {
        var mine = AddPickup(_resident);
        var theirs = AddPickup(_otherResident);
        await Service.CreateAsync(_resident, ValidDto(mine.Id));
        await Service.CreateAsync(_otherResident, ValidDto(theirs.Id));

        var page = await Service.GetListAsync(_resident, isAdmin: true, new ComplaintQueryParams());

        Assert.Equal(2, page.TotalCount);
    }

    [Fact]
    public async Task GetByIdAsync_returns_null_when_resident_does_not_own_complaint()
    {
        var pickup = AddPickup(_otherResident);
        var created = await Service.CreateAsync(_otherResident, ValidDto(pickup.Id));

        Assert.Null(await Service.GetByIdAsync(created.Id, _resident, isAdmin: false));
    }

    [Fact]
    public async Task UpdateAsync_sets_resolved_at_when_marked_resolved()
    {
        var pickup = AddPickup(_resident);
        var created = await Service.CreateAsync(_resident, ValidDto(pickup.Id));

        var updated = await Service.UpdateAsync(created.Id, new UpdateComplaintDto
        {
            Status = ComplaintStatus.Resolved,
            AdminNotes = "Crew revisited.",
        });

        Assert.NotNull(updated);
        Assert.NotNull(updated!.ResolvedAt);
        Assert.Equal(nameof(ComplaintStatus.Resolved), updated.Status);
        Assert.Equal("Crew revisited.", updated.AdminNotes);
    }

    [Fact]
    public async Task DeleteAsync_removes_complaint()
    {
        var pickup = AddPickup(_resident);
        var created = await Service.CreateAsync(_resident, ValidDto(pickup.Id));

        Assert.True(await Service.DeleteAsync(created.Id));
        Assert.Null(await Service.GetByIdAsync(created.Id, _resident, isAdmin: true));
    }
}
