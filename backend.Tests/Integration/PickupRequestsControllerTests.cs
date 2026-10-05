using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using backend.Data;
using backend.Models;

namespace backend.Tests.Integration;

// API integration + authentication/authorization tests. These drive the real
// controller through HTTP, so the [Authorize(Roles = ...)] pipeline and model
// validation (the automatic 400 from [ApiController]) are exercised end to end.
public class PickupRequestsControllerTests : IClassFixture<PickupApiFactory>
{
    private readonly PickupApiFactory _factory;

    public PickupRequestsControllerTests(PickupApiFactory factory) => _factory = factory;

    // Builds a client that presents the given role (or none, for anonymous).
    private HttpClient ClientAs(string? role, Guid? sub = null)
    {
        var client = _factory.CreateClient();
        if (role is not null)
        {
            client.DefaultRequestHeaders.Add(TestAuthHandler.RoleHeader, role);
            client.DefaultRequestHeaders.Add(TestAuthHandler.SubHeader,
                (sub ?? Guid.NewGuid()).ToString());
        }
        return client;
    }

    private static object ValidCreateBody(Guid zoneId) => new
    {
        zoneId,
        description = "Two bags of plastic bottles",
        address = "14/2 Temple Road, Dehiwala",
        contactPhone = "0771234567",
        preferredDate = DateTime.UtcNow.Date.AddDays(3),
    };

    // --- Authentication ---

    [Fact]
    public async Task Create_without_authentication_returns_401()
    {
        var client = ClientAs(role: null); // no role header -> anonymous
        var response = await client.PostAsJsonAsync("/api/pickuprequests", ValidCreateBody(Guid.NewGuid()));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // --- Authorization (role) ---

    [Fact]
    public async Task Create_as_a_collector_is_forbidden_on_a_resident_only_route()
    {
        var client = ClientAs("collector");
        var response = await client.PostAsJsonAsync("/api/pickuprequests", ValidCreateBody(Guid.NewGuid()));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task ValidatePhoto_as_an_admin_is_forbidden_resident_only()
    {
        var client = ClientAs("admin");
        var response = await client.PostAsJsonAsync("/api/pickuprequests/validate-photo",
            new { photoUrl = "https://example.com/x.jpg" });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // --- Model validation (400) ---

    [Fact]
    public async Task Create_with_missing_required_fields_returns_400()
    {
        var client = ClientAs("resident");
        // No address, phone, description, zone -> model + IValidatableObject fail.
        var response = await client.PostAsJsonAsync("/api/pickuprequests", new { });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ValidatePhoto_with_a_blank_url_returns_400()
    {
        var client = ClientAs("resident");
        var response = await client.PostAsJsonAsync("/api/pickuprequests/validate-photo",
            new { photoUrl = "" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // --- Happy paths ---

    [Fact]
    public async Task Create_with_a_valid_body_and_active_zone_returns_201()
    {
        var zoneId = Guid.NewGuid();
        await _factory.SeedAsync(db =>
        {
            db.Zones.Add(new Zone { Id = zoneId, Name = "Dehiwala", Description = "d", IsActive = true });
            return Task.CompletedTask;
        });

        var client = ClientAs("resident");
        var response = await client.PostAsJsonAsync("/api/pickuprequests", ValidCreateBody(zoneId));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task GetList_as_an_authenticated_resident_returns_200()
    {
        var client = ClientAs("resident");
        var response = await client.GetAsync("/api/pickuprequests");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
