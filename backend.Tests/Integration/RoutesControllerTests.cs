using System.Net;
using System.Net.Http.Json;
using backend.Models;

namespace backend.Tests.Integration;

public class RoutesControllerTests : IClassFixture<RouteApiFactory>
{
    private readonly RouteApiFactory _factory;

    public RoutesControllerTests(RouteApiFactory factory) => _factory = factory;

    private HttpClient ClientAs(string? role, Guid? sub = null)
    {
        var client = _factory.CreateClient();
        if (role is not null)
        {
            client.DefaultRequestHeaders.Add(TestAuthHandler.RoleHeader, role);
            client.DefaultRequestHeaders.Add(TestAuthHandler.SubHeader, (sub ?? Guid.NewGuid()).ToString());
        }
        return client;
    }

    [Fact]
    public async Task Create_without_authentication_returns_401()
    {
        var client = ClientAs(role: null);
        var response = await client.PostAsJsonAsync("/api/routes", new { });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Create_as_collector_is_forbidden_admin_only()
    {
        var client = ClientAs("collector");
        var response = await client.PostAsJsonAsync("/api/routes", new { });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Create_with_empty_body_returns_400()
    {
        var client = ClientAs("admin");
        var response = await client.PostAsJsonAsync("/api/routes", new { });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_with_valid_seed_returns_201_and_schedules_pickup()
    {
        var collectorId = Guid.NewGuid();
        var zoneId = Guid.NewGuid();
        var pickupId = Guid.NewGuid();

        await _factory.SeedAsync(db =>
        {
            db.Profiles.Add(new Profile
            {
                Id = collectorId,
                Email = "col@test.local",
                Role = "collector",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
            db.Zones.Add(new Zone { Id = zoneId, Name = "Dehiwala", Description = "d", IsActive = true });
            db.PickupRequests.Add(new PickupRequest
            {
                Id = pickupId,
                Description = "Bags",
                PreferredDate = DateTime.UtcNow.AddDays(2),
                Status = PickupStatus.Classified,
            });
            return Task.CompletedTask;
        });

        var client = ClientAs("admin");
        var response = await client.PostAsJsonAsync("/api/routes", new
        {
            pickupRequestId = pickupId,
            collectorId,
            zoneId,
            scheduledDate = DateTime.UtcNow.Date,
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task GetTodayRoute_as_another_collector_returns_403()
    {
        var collectorId = Guid.NewGuid();
        var otherCollector = Guid.NewGuid();
        var client = ClientAs("collector", otherCollector);
        var response = await client.GetAsync($"/api/routes/{collectorId}/today");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetTodayRoute_as_assigned_collector_returns_200()
    {
        var collectorId = Guid.NewGuid();
        var client = ClientAs("collector", collectorId);
        var response = await client.GetAsync($"/api/routes/{collectorId}/today");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
