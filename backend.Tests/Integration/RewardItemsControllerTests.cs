using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using backend.Models;

namespace backend.Tests.Integration;

// The reward catalog over real HTTP: who may manage it, what residents can see,
// and the status codes for bad input, unknown items and items still in use.
public class RewardItemsControllerTests : IClassFixture<RewardsApiFactory>
{
    private readonly RewardsApiFactory _factory;

    public RewardItemsControllerTests(RewardsApiFactory factory) => _factory = factory;

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

    private static object NewItem(string name, int cost = 50) => new { name, pointsCost = cost, delivery = "Collect" };

    private async Task<RewardItem> SeedItemAsync(string name, bool active = true)
    {
        var item = new RewardItem { Name = name, PointsCost = 25, IsActive = active };
        await _factory.SeedAsync(db => { db.RewardItems.Add(item); return Task.CompletedTask; });
        return item;
    }

    // Each test seeds items with a unique tag and searches for it, so tests
    // sharing the in-memory database do not see each other's rows.
    private static async Task<List<string>> NamesAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("items").EnumerateArray()
            .Select(i => i.GetProperty("name").GetString()!)
            .ToList();
    }

    [Fact]
    public async Task Create_without_authentication_returns_401()
    {
        var response = await ClientAs(null).PostAsJsonAsync("/api/reward-items", NewItem("Tote bag"));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("resident")]
    [InlineData("collector")]
    public async Task Only_admins_can_add_catalog_items(string role)
    {
        var response = await ClientAs(role).PostAsJsonAsync("/api/reward-items", NewItem("Tote bag"));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Admin_adds_an_item_and_gets_201_with_its_location()
    {
        var response = await ClientAs("admin").PostAsJsonAsync("/api/reward-items", NewItem("Seed packet", 10));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(response.Headers.Location);
        var created = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Seed packet", created.GetProperty("name").GetString());
        Assert.Equal(10, created.GetProperty("pointsCost").GetInt32());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public async Task An_item_must_cost_at_least_one_point(int cost)
    {
        var response = await ClientAs("admin").PostAsJsonAsync("/api/reward-items", NewItem("Free thing", cost));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task An_item_needs_a_name()
    {
        var response = await ClientAs("admin").PostAsJsonAsync("/api/reward-items", new { name = "", pointsCost = 5 });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Residents_see_only_active_items()
    {
        var tag = Guid.NewGuid().ToString("N")[..8];
        await SeedItemAsync($"Active {tag}");
        await SeedItemAsync($"Retired {tag}", active: false);

        var names = await NamesAsync(await ClientAs("resident").GetAsync($"/api/reward-items?search={tag}"));

        Assert.Equal(new[] { $"Active {tag}" }, names);
    }

    [Fact]
    public async Task Admins_see_retired_items_too()
    {
        var tag = Guid.NewGuid().ToString("N")[..8];
        await SeedItemAsync($"Active {tag}");
        await SeedItemAsync($"Retired {tag}", active: false);

        var names = await NamesAsync(await ClientAs("admin").GetAsync($"/api/reward-items?search={tag}"));

        Assert.Equal(2, names.Count);
    }

    [Fact]
    public async Task A_resident_cannot_open_a_retired_item()
    {
        var retired = await SeedItemAsync("Retired voucher", active: false);

        var asResident = await ClientAs("resident").GetAsync($"/api/reward-items/{retired.Id}");
        var asAdmin = await ClientAs("admin").GetAsync($"/api/reward-items/{retired.Id}");

        Assert.Equal(HttpStatusCode.NotFound, asResident.StatusCode);
        Assert.Equal(HttpStatusCode.OK, asAdmin.StatusCode);
    }

    [Fact]
    public async Task Admin_updates_an_item()
    {
        var item = await SeedItemAsync("Water bottle");

        var response = await ClientAs("admin").PutAsJsonAsync($"/api/reward-items/{item.Id}", NewItem("Steel water bottle", 60));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Steel water bottle", updated.GetProperty("name").GetString());
        Assert.Equal(60, updated.GetProperty("pointsCost").GetInt32());
    }

    [Fact]
    public async Task Updating_an_unknown_item_returns_404()
    {
        var response = await ClientAs("admin").PutAsJsonAsync($"/api/reward-items/{Guid.NewGuid()}", NewItem("Ghost"));
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Deleting_an_unused_item_returns_204_and_it_is_gone()
    {
        var item = await SeedItemAsync("Old leaflet");
        var admin = ClientAs("admin");

        var delete = await admin.DeleteAsync($"/api/reward-items/{item.Id}");
        var after = await admin.GetAsync($"/api/reward-items/{item.Id}");

        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, after.StatusCode);
    }

    [Fact]
    public async Task An_item_with_a_pending_request_cannot_be_deleted()
    {
        var resident = Guid.NewGuid();
        var item = await SeedItemAsync("Compost kit");
        await _factory.SeedAsync(db =>
        {
            db.Profiles.Add(new Profile { Id = resident, Email = $"{resident}@test.local", Role = "resident" });
            db.RedemptionRequests.Add(new RedemptionRequest
            {
                ResidentId = resident,
                RewardItemId = item.Id,
                Points = item.PointsCost,
                Reason = item.Name,
                Status = RedemptionStatus.Pending
            });
            return Task.CompletedTask;
        });

        var response = await ClientAs("admin").DeleteAsync($"/api/reward-items/{item.Id}");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Residents_cannot_delete_items()
    {
        var item = await SeedItemAsync("Bamboo toothbrush");
        var response = await ClientAs("resident").DeleteAsync($"/api/reward-items/{item.Id}");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
