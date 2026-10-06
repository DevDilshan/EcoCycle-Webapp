using backend.Data;
using backend.DTOs;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace backend.Tests.Services;

// Runs the real service against an in-memory database seeded with zones.
// GetPublicZonesAsync feeds an anonymous endpoint, so what it leaves out matters
// as much as what it returns.
public class ZoneServiceTests
{
    private readonly ApplicationDbContext _db = new(
        new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private ZoneService Service => new(
        _db,
        new PickupSchedulingService(
            _db,
            new UnreachableAgentClient(),
            new RoutingOptionBuilder(_db),
            NullLogger<PickupSchedulingService>.Instance),
        NullLogger<ZoneService>.Instance);

    [Fact]
    public async Task AdministrativeReferenceRequiresCoverageReviewAndRoundTripsAfterReview()
    {
        const string geometry = "{\"type\":\"Polygon\",\"coordinates\":[[[79.84,6.9],[79.9,6.9],[79.9,6.95],[79.84,6.95],[79.84,6.9]]]}";
        var dto = new CreateZoneDto {
            Name = "Reviewed collection area", BoundaryGeoJson = geometry,
            BoundaryReference = new BoundaryReferenceDto { DatasetId = "lka-cod-ab-v03", AreaCode = "LK1103", AreaName = "Colombo", AdministrativeLevel = 3 }
        };
        await Assert.ThrowsAsync<ArgumentException>(() => Service.CreateZoneAsync(dto));
        Assert.Empty(await _db.Zones.ToListAsync());
        dto.ConfirmCollectionCoverage = true;
        var created = await Service.CreateZoneAsync(dto);
        Assert.Equal("LK1103", created.BoundaryReference!.AreaCode);
        Assert.NotNull(created.BoundaryCoverageReviewedAt);
        dto.ConfirmCollectionCoverage = false;
        dto.BoundaryReference.AdjustedByAdmin = true;
        await Assert.ThrowsAsync<ArgumentException>(() => Service.UpdateZoneAsync(created.Id, dto));
        Assert.False((await Service.GetZoneByIdAsync(created.Id))!.BoundaryReference!.AdjustedByAdmin);
        dto.ConfirmCollectionCoverage = true;
        await Service.UpdateZoneAsync(created.Id, dto);
        Assert.True((await Service.GetZoneByIdAsync(created.Id))!.BoundaryReference!.AdjustedByAdmin);
        dto.BoundaryReference = null;
        dto.BoundaryGeoJson = null;
        await Service.UpdateZoneAsync(created.Id, dto);
        var cleared = await Service.GetZoneByIdAsync(created.Id);
        Assert.Null(cleared!.BoundaryReference);
        Assert.Null(cleared.BoundaryCoverageReviewedAt);
    }

    [Fact]
    public async Task BoundarySavesDerivesAnAnchorAndIsAvailableToPublicAndResidentMaps()
    {
        const string json = "{\"type\":\"Polygon\",\"coordinates\":[[[79.84,6.9],[79.9,6.9],[79.9,6.95],[79.84,6.95],[79.84,6.9]]]}";
        var created = await Service.CreateZoneAsync(new CreateZoneDto { Name = "Demo area", BoundaryGeoJson = json });
        Assert.Equal(json, created.BoundaryGeoJson);
        Assert.NotNull(created.Latitude);
        Assert.Equal(json, Assert.Single(await Service.GetPublicZonesAsync()).BoundaryGeoJson);
        Assert.Equal(json, Assert.Single(await Service.GetSelectableZonesAsync()).BoundaryGeoJson);
        await Service.UpdateZoneAsync(created.Id, new CreateZoneDto { Name = "Demo area", Latitude = created.Latitude, Longitude = created.Longitude });
        Assert.Null((await Service.GetZoneByIdAsync(created.Id))!.BoundaryGeoJson);
    }

    // The agent service as the backend sees it when it is down: every call
    // answers null. Nothing these tests cover should need it.
    private sealed class UnreachableAgentClient : IAgentPipelineClient
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

    private Zone AddZone(
        string name,
        bool isActive = true,
        double? latitude = 6.9271,
        double? longitude = 79.8612,
        Guid? collectorId = null)
    {
        var zone = new Zone
        {
            Name = name,
            Description = $"{name} description",
            IsActive = isActive,
            Latitude = latitude,
            Longitude = longitude,
            AssignedCollectorId = collectorId,
        };

        _db.Zones.Add(zone);
        _db.SaveChanges();
        return zone;
    }

    [Fact]
    public async Task ReturnsActiveZonesThatHaveCoordinates()
    {
        var zone = AddZone("Borella", latitude: 6.9111, longitude: 79.8776);

        var result = await Service.GetPublicZonesAsync();

        var only = Assert.Single(result);
        Assert.Equal(zone.Id, only.Id);
        Assert.Equal("Borella", only.Name);
        Assert.Equal(6.9111, only.Latitude);
        Assert.Equal(79.8776, only.Longitude);
    }

    [Fact]
    public async Task ExcludesInactiveZones()
    {
        AddZone("Retired zone", isActive: false);

        Assert.Empty(await Service.GetPublicZonesAsync());
    }

    [Theory]
    [InlineData(null, 79.8612)]
    [InlineData(6.9271, null)]
    [InlineData(null, null)]
    public async Task ExcludesZonesMissingEitherCoordinate(double? latitude, double? longitude)
    {
        AddZone("Unplaced zone", latitude: latitude, longitude: longitude);

        Assert.Empty(await Service.GetPublicZonesAsync());
    }

    [Fact]
    public async Task OrdersByName()
    {
        AddZone("Nugegoda");
        AddZone("Borella");
        AddZone("Dehiwala");

        var result = await Service.GetPublicZonesAsync();

        Assert.Equal(new[] { "Borella", "Dehiwala", "Nugegoda" }, result.Select(z => z.Name));
    }

    // The point of the separate DTO: an anonymous caller must not learn which
    // collector covers an area. PublicZoneDto has no property for it at all,
    // which this asserts by reflection so the test fails if one is ever added.
    [Fact]
    public async Task DoesNotExposeOperationalFields()
    {
        AddZone("Colombo Fort", collectorId: Guid.NewGuid());

        var result = await Service.GetPublicZonesAsync();

        var propertyNames = Assert.Single(result).GetType()
            .GetProperties()
            .Select(p => p.Name)
            .ToArray();

        Assert.Equal(new[] { "Id", "Name", "Latitude", "Longitude", "BoundaryGeoJson" }, propertyNames);
    }

    [Fact]
    public async Task A_retired_zone_with_no_history_can_be_deleted_for_good()
    {
        var zone = AddZone("Made by mistake", isActive: false);

        Assert.True(await Service.DeleteZonePermanentlyAsync(zone.Id));
        Assert.False(_db.Zones.Any(z => z.Id == zone.Id));
        Assert.Null(await Service.DeleteZonePermanentlyAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task An_active_zone_or_one_with_pickups_is_never_deleted()
    {
        var active = AddZone("Still in use");
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service.DeleteZonePermanentlyAsync(active.Id));

        var used = AddZone("Has history", isActive: false);
        _db.PickupRequests.Add(new PickupRequest
        {
            ResidentId = Guid.NewGuid(), ZoneId = used.Id, PhotoUrl = "https://example.com/p.jpg",
            Description = "Old pickup", Status = PickupStatus.Completed,
        });
        _db.SaveChanges();

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => Service.DeleteZonePermanentlyAsync(used.Id));
        Assert.Contains("1 pickup request(s)", error.Message);
        Assert.True(_db.Zones.Any(z => z.Id == used.Id));
    }
}
