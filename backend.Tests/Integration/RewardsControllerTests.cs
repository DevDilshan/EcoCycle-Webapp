using System.Net;
using System.Net.Http.Json;
using backend.Models;

namespace backend.Tests.Integration;

public class RewardsControllerTests : IClassFixture<RewardsApiFactory>
{
    private readonly RewardsApiFactory _factory;

    public RewardsControllerTests(RewardsApiFactory factory) => _factory = factory;

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
    public async Task Award_without_authentication_returns_401()
    {
        var client = ClientAs(role: null);
        var response = await client.PostAsJsonAsync("/api/rewards", new { });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Award_as_resident_is_forbidden()
    {
        var client = ClientAs("resident");
        var response = await client.PostAsJsonAsync("/api/rewards", new
        {
            residentId = Guid.NewGuid(),
            pickupRequestId = Guid.NewGuid(),
            pointsEarned = 5,
            reason = "Manual adjustment",
        });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Award_with_invalid_points_returns_400()
    {
        var client = ClientAs("admin");
        var response = await client.PostAsJsonAsync("/api/rewards", new
        {
            residentId = Guid.NewGuid(),
            pickupRequestId = Guid.NewGuid(),
            pointsEarned = 0,
            reason = "Invalid zero points",
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetLeaderboard_as_resident_returns_200()
    {
        var client = ClientAs("resident");
        var response = await client.GetAsync("/api/rewards/leaderboard?limit=5");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Validate_classified_pickup_as_admin_returns_200()
    {
        var pickupId = Guid.NewGuid();
        await _factory.SeedAsync(db =>
        {
            var pickup = new PickupRequest
            {
                Id = pickupId,
                Description = "Plastic bottles",
                PreferredDate = DateTime.UtcNow.AddDays(2),
                Status = PickupStatus.Classified,
            };
            db.PickupRequests.Add(pickup);
            db.WasteClassifications.Add(new WasteClassification
            {
                PickupRequestId = pickupId,
                Category = WasteCategory.Recyclable,
                Confidence = 0.95,
                Reasoning = "Clear recyclables",
            });
            return Task.CompletedTask;
        });

        var client = ClientAs("admin");
        var response = await client.PostAsync($"/api/rewards/validate/{pickupId}", content: null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
