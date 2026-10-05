using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using backend.Models;
using backend.Services;

namespace backend.Tests.Integration;

// In-process workflow: admin books a stop -> collector sees today -> completes.
public class RouteDispatchWorkflowE2ETests : IClassFixture<RouteApiFactory>
{
    private readonly RouteApiFactory _factory;

    public RouteDispatchWorkflowE2ETests(RouteApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Admin_books_a_stop_collector_completes_it_and_pickup_is_closed()
    {
        var collectorId = Guid.NewGuid();
        var zoneId = Guid.NewGuid();
        var pickupId = Guid.NewGuid();
        var residentId = Guid.NewGuid();

        await _factory.SeedAsync(db =>
        {
            db.Profiles.AddRange(
                new Profile
                {
                    Id = collectorId,
                    Email = "col@test.local",
                    Role = "collector",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                },
                new Profile
                {
                    Id = residentId,
                    Email = "res@test.local",
                    Role = "resident",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                });
            db.Zones.Add(new Zone { Id = zoneId, Name = "Dehiwala", Description = "d", IsActive = true });
            db.PickupRequests.Add(new PickupRequest
            {
                Id = pickupId,
                ResidentId = residentId,
                Description = "Plastic bottles",
                PreferredDate = DateTime.UtcNow.AddDays(1),
                Status = PickupStatus.Classified,
            });
            db.WasteClassifications.Add(new WasteClassification
            {
                PickupRequestId = pickupId,
                Category = WasteCategory.Recyclable,
                Confidence = 0.9,
                Reasoning = "test",
            });
            return Task.CompletedTask;
        });

        var admin = Client("admin");
        var create = await admin.PostAsJsonAsync("/api/routes", new
        {
            pickupRequestId = pickupId,
            collectorId,
            zoneId,
            scheduledDate = ServiceClock.Today,
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var routeId = (await create.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        var collector = Client("collector", collectorId);
        var today = await collector.GetAsync($"/api/routes/{collectorId}/today");
        Assert.Equal(HttpStatusCode.OK, today.StatusCode);
        var stops = await today.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(stops.EnumerateArray(), s => s.GetProperty("id").GetGuid() == routeId);

        var complete = await collector.PatchAsJsonAsync($"/api/routes/{routeId}/complete", new { issueNotes = (string?)null });
        Assert.Equal(HttpStatusCode.OK, complete.StatusCode);

        var pickup = await admin.GetAsync($"/api/pickuprequests/{pickupId}");
        Assert.Equal(HttpStatusCode.OK, pickup.StatusCode);
        var status = (await pickup.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("status").GetString();
        Assert.Equal("Completed", status);
    }

    private HttpClient Client(string role, Guid? sub = null)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.RoleHeader, role);
        client.DefaultRequestHeaders.Add(TestAuthHandler.SubHeader, (sub ?? Guid.NewGuid()).ToString());
        return client;
    }
}
