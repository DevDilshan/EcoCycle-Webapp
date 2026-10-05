using System.Net;
using System.Net.Http.Json;
using backend.Models;

namespace backend.Tests.Integration;

public class RedemptionsControllerTests : IClassFixture<RewardsApiFactory>
{
    private readonly RewardsApiFactory _factory;

    public RedemptionsControllerTests(RewardsApiFactory factory) => _factory = factory;

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
        var response = await client.PostAsJsonAsync("/api/redemptions", new { rewardItemId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Create_as_admin_is_forbidden_resident_only()
    {
        var client = ClientAs("admin");
        var response = await client.PostAsJsonAsync("/api/redemptions", new { rewardItemId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Create_with_missing_item_returns_404()
    {
        var residentId = Guid.NewGuid();
        await _factory.SeedAsync(db =>
        {
            db.Profiles.Add(new Profile
            {
                Id = residentId,
                Email = "res@test.local",
                Role = "resident",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
            return Task.CompletedTask;
        });

        var client = ClientAs("resident", residentId);
        var response = await client.PostAsJsonAsync("/api/redemptions", new { rewardItemId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetList_as_resident_returns_200()
    {
        var client = ClientAs("resident");
        var response = await client.GetAsync("/api/redemptions");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
