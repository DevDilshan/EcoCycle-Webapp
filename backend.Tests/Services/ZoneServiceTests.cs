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

        Assert.Equal(new[] { "Id", "Name", "Latitude", "Longitude" }, propertyNames);
    }
}
