using System.Net;
using System.Net.Http.Json;
using backend.Models;

namespace backend.Tests.Integration;

public class ComplaintsControllerTests : IClassFixture<ComplaintsApiFactory>
{
    private readonly ComplaintsApiFactory _factory;

    public ComplaintsControllerTests(ComplaintsApiFactory factory) => _factory = factory;

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
        var response = await client.PostAsJsonAsync("/api/complaints", new { });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Create_as_admin_is_forbidden_resident_only()
    {
        var client = ClientAs("admin");
        var response = await client.PostAsJsonAsync("/api/complaints", new
        {
            pickupRequestId = Guid.NewGuid(),
            description = "The crew never arrived on the scheduled day.",
        });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Create_with_short_description_returns_400()
    {
        var client = ClientAs("resident");
        var response = await client.PostAsJsonAsync("/api/complaints", new
        {
            pickupRequestId = Guid.NewGuid(),
            description = "Too short",
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_with_valid_body_returns_201()
    {
        var residentId = Guid.NewGuid();
        var pickupId = Guid.NewGuid();
        await _factory.SeedAsync(db =>
        {
            db.PickupRequests.Add(new PickupRequest
            {
                Id = pickupId,
                ResidentId = residentId,
                Description = "Waste",
                PreferredDate = DateTime.UtcNow.AddDays(1),
                Status = PickupStatus.Classified,
            });
            return Task.CompletedTask;
        });

        var client = ClientAs("resident", residentId);
        var response = await client.PostAsJsonAsync("/api/complaints", new
        {
            pickupRequestId = pickupId,
            description = "The crew missed my bags on the scheduled day.",
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task GetList_as_resident_returns_200()
    {
        var client = ClientAs("resident");
        var response = await client.GetAsync("/api/complaints");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
