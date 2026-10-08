using backend.Data;
using backend.DTOs;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace backend.Tests.Services;

// Service-layer tests: the real PickupRequestService against an in-memory
// database. The agent service is stubbed (always "down") because none of the
// behaviour under test needs it -- these cover create, the 30-minute cancel
// window, edit rules and list visibility, which are the service's business
// rules, not its AI calls.
public class PickupRequestServiceTests
{
    private readonly ApplicationDbContext _db = new(
        new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private readonly Guid _resident = Guid.NewGuid();
    private readonly Guid _otherResident = Guid.NewGuid();

    [Fact]
    public async Task RejectsOutsidePinsOnCreateAndEditBeforeChangingStoredData()
    {
        var zone = AddActiveZone();
        zone.BoundaryGeoJson = "{\"type\":\"Polygon\",\"coordinates\":[[[79.84,6.9],[79.9,6.9],[79.9,6.95],[79.84,6.95],[79.84,6.9]]]}";
        await _db.SaveChangesAsync();
        var dto = new CreatePickupRequestDto { ZoneId = zone.Id, Description = "Paper", PreferredDate = DateTime.UtcNow.AddDays(2), Latitude = 6.97, Longitude = 79.91 };
        await Assert.ThrowsAsync<ArgumentException>(() => Service.CreateAsync(_resident, dto));
        Assert.Empty(_db.PickupRequests);
        dto.Latitude = 6.91; dto.Longitude = 79.85;
        var saved = await Service.CreateAsync(_resident, dto);
        await Assert.ThrowsAsync<ArgumentException>(() => Service.UpdateAsync(saved.Id, _resident, false,
            new UpdatePickupRequestDto { Description = "Changed", PreferredDate = dto.PreferredDate, Latitude = 6.97, Longitude = 79.91 }));
        Assert.Equal("Paper", (await _db.PickupRequests.FindAsync(saved.Id))!.Description);
        Assert.Equal(6.91, (await _db.PickupRequests.FindAsync(saved.Id))!.Latitude);
        dto.Latitude = null; dto.Longitude = null;
        await Service.CreateAsync(_resident, dto); // Address-only booking remains possible.
        Assert.Equal(2, await _db.PickupRequests.CountAsync());
    }

    private PickupRequestService Service => new(
        _db,
        new StubAgentClient(),
        new RouteAssignmentService(_db, new RewardService(_db)),
        new RoutingOptionBuilder(_db),
        NullLogger<PickupRequestService>.Instance);

    // --- CreateAsync ---

    [Fact]
    public async Task CreateAsync_persists_pending_pickup_with_utc_date_and_trimmed_fields()
    {
        var zone = AddActiveZone();
        var dto = new CreatePickupRequestDto
        {
            ZoneId = zone.Id,
            Description = "Two bags of plastic bottles",
            // Deliberately not UTC: the service must normalise it, or Npgsql
            // throws on a timestamptz column at runtime.
            PreferredDate = DateTime.SpecifyKind(DateTime.Today.AddDays(3), DateTimeKind.Unspecified),
            Address = "  14/2 Temple Road  ",
            ContactPhone = "  0771234567 ",
            Latitude = 6.9271,
            Longitude = 79.8612,
        };

        var result = await Service.CreateAsync(_resident, dto);

        var saved = await _db.PickupRequests.SingleAsync(p => p.Id == result.Id);
        Assert.Equal(PickupStatus.Pending, saved.Status);
        Assert.Equal(DateTimeKind.Utc, saved.PreferredDate.Kind);
        Assert.Equal("14/2 Temple Road", saved.Address);
        Assert.Equal("0771234567", saved.ContactPhone);
        Assert.Equal(6.9271, saved.Latitude);
        Assert.Equal(_resident, saved.ResidentId);
    }

    [Fact]
    public async Task CreateAsync_rejects_an_unknown_or_inactive_zone()
    {
        // No zone seeded at all -> the id cannot resolve to an active zone.
        var dto = new CreatePickupRequestDto
        {
            ZoneId = Guid.NewGuid(),
            Description = "plastic bottles",
            PreferredDate = DateTime.Today.AddDays(3),
            ContactPhone = "0771234567",
        };

        await Assert.ThrowsAsync<ArgumentException>(() => Service.CreateAsync(_resident, dto));
        Assert.Empty(_db.PickupRequests); // nothing half-saved
    }

    // --- DeleteAsync: the 30-minute resident cancel window ---

    [Fact]
    public async Task DeleteAsync_within_the_window_cancels_and_removes_the_row()
    {
        var pickup = AddPickup(_resident, createdAt: DateTime.UtcNow.AddMinutes(-5));

        var result = await Service.DeleteAsync(pickup.Id, _resident, isAdmin: false);

        Assert.Equal(PickupOperationResult.Success, result);
        Assert.False(await _db.PickupRequests.AnyAsync(p => p.Id == pickup.Id));
    }

    [Fact]
    public async Task DeleteAsync_after_30_minutes_is_refused_and_keeps_the_row()
    {
        var pickup = AddPickup(_resident, createdAt: DateTime.UtcNow.AddMinutes(-31));

        var result = await Service.DeleteAsync(pickup.Id, _resident, isAdmin: false);

        Assert.Equal(PickupOperationResult.CancelWindowExpired, result);
        Assert.True(await _db.PickupRequests.AnyAsync(p => p.Id == pickup.Id));
    }

    [Fact]
    public async Task DeleteAsync_lets_an_admin_cancel_outside_the_window()
    {
        var pickup = AddPickup(_resident, createdAt: DateTime.UtcNow.AddHours(-3));

        var result = await Service.DeleteAsync(pickup.Id, _resident, isAdmin: true);

        Assert.Equal(PickupOperationResult.Success, result);
    }

    [Fact]
    public async Task DeleteAsync_forbids_cancelling_someone_elses_request()
    {
        var pickup = AddPickup(_resident, createdAt: DateTime.UtcNow);

        var result = await Service.DeleteAsync(pickup.Id, _otherResident, isAdmin: false);

        Assert.Equal(PickupOperationResult.Forbidden, result);
    }

    [Fact]
    public async Task DeleteAsync_returns_NotFound_for_an_unknown_id()
    {
        var result = await Service.DeleteAsync(Guid.NewGuid(), _resident, isAdmin: false);
        Assert.Equal(PickupOperationResult.NotFound, result);
    }

    [Fact]
    public async Task DeleteAsync_refuses_a_completed_pickup_even_inside_the_window()
    {
        var pickup = AddPickup(_resident, createdAt: DateTime.UtcNow, status: PickupStatus.Completed);

        var result = await Service.DeleteAsync(pickup.Id, _resident, isAdmin: false);

        Assert.Equal(PickupOperationResult.NotEditable, result);
    }

    // --- UpdateAsync ---

    [Fact]
    public async Task UpdateAsync_keeps_the_stored_contact_phone_when_the_edit_omits_it()
    {
        var pickup = AddPickup(_resident, createdAt: DateTime.UtcNow, contactPhone: "0771234567");

        var dto = new UpdatePickupRequestDto
        {
            Description = "updated description",
            PreferredDate = DateTime.Today.AddDays(2),
            ContactPhone = null,   // omitted: must not wipe the stored number
            Address = null,
        };

        await Service.UpdateAsync(pickup.Id, _resident, isAdmin: false, dto);

        var saved = await _db.PickupRequests.SingleAsync(p => p.Id == pickup.Id);
        Assert.Equal("0771234567", saved.ContactPhone);
        Assert.Equal("updated description", saved.Description);
    }

    [Fact]
    public async Task UpdateAsync_refuses_to_edit_a_non_pending_request()
    {
        var pickup = AddPickup(_resident, createdAt: DateTime.UtcNow, status: PickupStatus.Scheduled);

        var dto = new UpdatePickupRequestDto
        {
            Description = "too late to change",
            PreferredDate = DateTime.Today.AddDays(2),
        };

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => Service.UpdateAsync(pickup.Id, _resident, isAdmin: false, dto));
    }

    [Fact]
    public async Task UpdateAsync_forbids_editing_someone_elses_request()
    {
        var pickup = AddPickup(_resident, createdAt: DateTime.UtcNow);

        var dto = new UpdatePickupRequestDto
        {
            Description = "not my request",
            PreferredDate = DateTime.Today.AddDays(2),
        };

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => Service.UpdateAsync(pickup.Id, _otherResident, isAdmin: false, dto));
    }

    // --- GetListAsync: visibility and filtering ---

    [Fact]
    public async Task GetListAsync_shows_a_resident_only_their_own_requests()
    {
        AddPickup(_resident, DateTime.UtcNow);
        AddPickup(_resident, DateTime.UtcNow);
        AddPickup(_otherResident, DateTime.UtcNow);

        var page = await Service.GetListAsync(_resident, isAdmin: false, isCollector: false,
            new PickupRequestQueryParams());

        Assert.Equal(2, page.TotalCount);
        Assert.All(page.Items, p => Assert.Equal(_resident, p.ResidentId));
    }

    [Fact]
    public async Task GetListAsync_shows_an_admin_everyones_requests()
    {
        AddPickup(_resident, DateTime.UtcNow);
        AddPickup(_otherResident, DateTime.UtcNow);

        var page = await Service.GetListAsync(_resident, isAdmin: true, isCollector: false,
            new PickupRequestQueryParams());

        Assert.Equal(2, page.TotalCount);
    }

    [Fact]
    public async Task GetListAsync_filters_by_status()
    {
        AddPickup(_resident, DateTime.UtcNow, status: PickupStatus.Pending);
        AddPickup(_resident, DateTime.UtcNow, status: PickupStatus.Completed);

        var page = await Service.GetListAsync(_resident, isAdmin: false, isCollector: false,
            new PickupRequestQueryParams { Status = PickupStatus.Completed });

        Assert.Equal(1, page.TotalCount);
        Assert.All(page.Items, p => Assert.Equal("Completed", p.Status));
    }

    // --- helpers ---

    private Zone AddActiveZone(string name = "Dehiwala")
    {
        var zone = new Zone { Name = name, Description = $"{name} desc", IsActive = true };
        _db.Zones.Add(zone);
        _db.SaveChanges();
        return zone;
    }

    private PickupRequest AddPickup(
        Guid residentId,
        DateTime createdAt,
        PickupStatus status = PickupStatus.Pending,
        string? contactPhone = null)
    {
        var pickup = new PickupRequest
        {
            ResidentId = residentId,
            Description = "plastic bottles",
            PreferredDate = DateTime.SpecifyKind(DateTime.Today.AddDays(1), DateTimeKind.Utc),
            Status = status,
            ContactPhone = contactPhone,
            CreatedAt = createdAt,
        };
        _db.PickupRequests.Add(pickup);
        _db.SaveChanges();
        return pickup;
    }

    // The agent service as the backend sees it when it is down: every call
    // answers null. The behaviour under test never needs a live agent.
    private sealed class StubAgentClient : IAgentPipelineClient
    {
        public Task<PipelineResultDto?> RunPipelineAsync(
            RunPipelineRequestDto request, CancellationToken cancellationToken = default) =>
            Task.FromResult<PipelineResultDto?>(null);

        public Task<RoutingDto?> RouteApprovedPickupAsync(
            RouteApprovedPickupRequestDto request, CancellationToken cancellationToken = default) =>
            Task.FromResult<RoutingDto?>(null);

        public Task<RoutingDto?> ChooseSlotAsync(
            RoutingContextDto context, CancellationToken cancellationToken = default) =>
            Task.FromResult<RoutingDto?>(null);

        public Task<MissedExplanationDto?> ExplainMissedAsync(
            ExplainMissedRequestDto request, CancellationToken cancellationToken = default) =>
            Task.FromResult<MissedExplanationDto?>(null);

        public Task<DecisionExplanationDto?> ExplainDecisionAsync(
            ExplainDecisionRequestDto request, CancellationToken cancellationToken = default) =>
            Task.FromResult<DecisionExplanationDto?>(null);

        public Task<ImageValidationDto?> ValidateImageAsync(
            ValidateImageRequestDto request, CancellationToken cancellationToken = default) =>
            Task.FromResult<ImageValidationDto?>(null);
    }
}
