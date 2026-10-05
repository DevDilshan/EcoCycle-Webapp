using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using backend.Data;
using backend.Models;
using backend.Tests.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace backend.Tests.Integration;

// End-to-end workflow for a resident pickup, exercising every layer for real
// except the Python agent (scripted at its HTTP-client boundary):
//
//   HTTP request (Flutter/React stand-in)
//     -> ASP.NET Core controller + service
//       -> PostgreSQL (pickup row persisted, then its classification)
//         -> Agent pipeline (returns a classification)
//           -> status advances Pending -> Classified, category stored
//
// Skips when no test PostgreSQL is available (e.g. on CI).
[Collection("Postgres")]
public class PickupWorkflowE2ETests : IDisposable
{
    private readonly PostgresFixture _pg;
    private readonly PickupE2EFactory? _factory;
    // Fixed so the authenticated user and the seeded profile row are the same.
    private static readonly Guid Resident = Guid.Parse("00000000-0000-0000-0000-000000000001");

    public PickupWorkflowE2ETests(PostgresFixture pg)
    {
        _pg = pg;
        if (_pg.Available)
            _factory = new PickupE2EFactory(_pg.ConnectionString);
    }

    public void Dispose() => _factory?.Dispose();

    [SkippableFact]
    public async Task Resident_creates_a_pickup_then_the_agent_classifies_it_end_to_end()
    {
        Skip.IfNot(_pg.Available, _pg.SkipReason);

        // --- Arrange: a profile for the FK, and an active zone to book into. ---
        await _pg.AddProfileAsync(Resident);
        var zoneId = await SeedActiveZoneAsync();

        var client = _factory!.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.RoleHeader, "resident");
        client.DefaultRequestHeaders.Add(TestAuthHandler.SubHeader, Resident.ToString());

        // --- Act 1: create the pickup (Flutter/React -> API -> PostgreSQL). ---
        var createResponse = await client.PostAsJsonAsync("/api/pickuprequests", new
        {
            zoneId,
            description = "Two bags of plastic bottles",
            address = "14/2 Temple Road, Dehiwala",
            contactPhone = "0771234567",
            preferredDate = DateTime.UtcNow.Date.AddDays(3),
        });
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var pickupId = (await ReadJson(createResponse)).GetProperty("id").GetGuid();

        // It is really in PostgreSQL, and Pending before any classification.
        var afterCreate = await GetPickup(client, pickupId);
        Assert.Equal("Pending", afterCreate.GetProperty("status").GetString());

        // --- Act 2: run the agent pipeline (API -> agent -> PostgreSQL). ---
        var pipelineResponse = await client.PostAsync(
            $"/api/pickuprequests/{pickupId}/run-agent-pipeline", content: null);
        Assert.Equal(HttpStatusCode.OK, pipelineResponse.StatusCode);
        Assert.True((await ReadJson(pipelineResponse)).GetProperty("success").GetBoolean());

        // --- Assert: the workflow advanced and persisted the classification. ---
        var afterClassify = await GetPickup(client, pickupId);
        Assert.Equal("Classified", afterClassify.GetProperty("status").GetString());
        Assert.Equal(PickupE2EFactory.ClassifiedCategory,
            afterClassify.GetProperty("category").GetString());

        // The classification row is really in PostgreSQL, not just in the response.
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var stored = await db.WasteClassifications
            .AsNoTracking()
            .SingleAsync(c => c.PickupRequestId == pickupId);
        Assert.Equal(WasteCategory.Recyclable, stored.Category);

        var persistedStatus = await db.PickupRequests
            .AsNoTracking()
            .Where(p => p.Id == pickupId)
            .Select(p => p.Status)
            .SingleAsync();
        Assert.Equal(PickupStatus.Classified, persistedStatus);
    }

    // --- helpers ---

    private async Task<Guid> SeedActiveZoneAsync()
    {
        using var scope = _factory!.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var zone = new Zone { Name = "Dehiwala E2E", Description = "e2e zone", IsActive = true };
        db.Zones.Add(zone);
        await db.SaveChangesAsync();
        return zone.Id;
    }

    private static async Task<JsonElement> GetPickup(HttpClient client, Guid id)
    {
        var response = await client.GetAsync($"/api/pickuprequests/{id}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJson(response);
    }

    private static async Task<JsonElement> ReadJson(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync();
        return JsonDocument.Parse(text).RootElement.Clone();
    }
}
