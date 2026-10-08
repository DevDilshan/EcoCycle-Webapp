using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using backend.Data;
using backend.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace backend.Tests.Integration;

// What happens to a redemption request after it is made, over real HTTP:
// a resident changing or cancelling it, and an admin approving, rejecting
// and recording the hand-over.
public class RedemptionReviewControllerTests : IClassFixture<RewardsApiFactory>
{
    private readonly RewardsApiFactory _factory;

    public RedemptionReviewControllerTests(RewardsApiFactory factory) => _factory = factory;

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

    private sealed record Seeded(Guid ResidentId, Guid ItemId, Guid RequestId);

    // A resident with `points` in the ledger and one pending request for an
    // item costing `cost` (with `stock` left, or unlimited when null).
    private async Task<Seeded> SeedPendingAsync(int points = 100, int cost = 40, int? stock = 5)
    {
        var resident = Guid.NewGuid();
        var item = new RewardItem { Name = "Grocery voucher", PointsCost = cost, Stock = stock };
        var request = new RedemptionRequest
        {
            ResidentId = resident,
            RewardItemId = item.Id,
            Points = cost,
            Reason = item.Name,
            Status = RedemptionStatus.Pending
        };
        await _factory.SeedAsync(db =>
        {
            db.Profiles.Add(new Profile { Id = resident, Email = $"{resident}@test.local", FullName = "Resi", Role = "resident" });
            db.RewardPoints.Add(new RewardPoint { ResidentId = resident, PointsEarned = points, Reason = "seed" });
            db.RewardItems.Add(item);
            db.RedemptionRequests.Add(request);
            return Task.CompletedTask;
        });
        return new Seeded(resident, item.Id, request.Id);
    }

    private async Task<T> ReadDbAsync<T>(Func<ApplicationDbContext, Task<T>> read)
    {
        using var scope = _factory.Services.CreateScope();
        return await read(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>());
    }

    private static async Task<JsonElement> BodyAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    // ---- approve -------------------------------------------------------

    [Theory]
    [InlineData("resident")]
    [InlineData("collector")]
    public async Task Only_admins_can_approve(string role)
    {
        var s = await SeedPendingAsync();
        var response = await ClientAs(role, s.ResidentId).PostAsJsonAsync($"/api/redemptions/{s.RequestId}/approve", new { });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Approving_deducts_the_points_takes_one_from_stock_and_issues_a_code()
    {
        var s = await SeedPendingAsync(points: 100, cost: 40, stock: 5);

        var response = await ClientAs("admin").PostAsJsonAsync($"/api/redemptions/{s.RequestId}/approve", new { adminNote = "Enjoy" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await BodyAsync(response);
        Assert.Equal("Approved", body.GetProperty("status").GetString());
        Assert.StartsWith("ECO-", body.GetProperty("collectionCode").GetString());

        var balance = await ReadDbAsync(db => db.RewardPoints.Where(r => r.ResidentId == s.ResidentId).SumAsync(r => r.PointsEarned));
        var stock = await ReadDbAsync(db => db.RewardItems.Where(i => i.Id == s.ItemId).Select(i => i.Stock).SingleAsync());
        Assert.Equal(60, balance);
        Assert.Equal(4, stock);
    }

    [Fact]
    public async Task A_request_cannot_be_approved_twice()
    {
        var s = await SeedPendingAsync();
        var admin = ClientAs("admin");

        await admin.PostAsJsonAsync($"/api/redemptions/{s.RequestId}/approve", new { });
        var second = await admin.PostAsJsonAsync($"/api/redemptions/{s.RequestId}/approve", new { });

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task Approval_is_refused_when_the_balance_has_dropped_below_the_cost()
    {
        var s = await SeedPendingAsync(points: 100, cost: 40);
        await _factory.SeedAsync(db =>
        {
            db.RewardPoints.Add(new RewardPoint { ResidentId = s.ResidentId, PointsEarned = -80, Reason = "correction" });
            return Task.CompletedTask;
        });

        var response = await ClientAs("admin").PostAsJsonAsync($"/api/redemptions/{s.RequestId}/approve", new { });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Approval_is_refused_when_the_item_is_out_of_stock()
    {
        var s = await SeedPendingAsync(stock: 0);
        var response = await ClientAs("admin").PostAsJsonAsync($"/api/redemptions/{s.RequestId}/approve", new { });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Approving_an_unknown_request_returns_404()
    {
        var response = await ClientAs("admin").PostAsJsonAsync($"/api/redemptions/{Guid.NewGuid()}/approve", new { });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ---- reject --------------------------------------------------------

    [Theory]
    [InlineData(null)]
    [InlineData("   ")]
    public async Task Rejecting_needs_a_note(string? note)
    {
        var s = await SeedPendingAsync();
        var response = await ClientAs("admin").PostAsJsonAsync($"/api/redemptions/{s.RequestId}/reject", new { adminNote = note });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Rejecting_with_a_note_keeps_the_residents_points()
    {
        var s = await SeedPendingAsync(points: 100);

        var response = await ClientAs("admin").PostAsJsonAsync($"/api/redemptions/{s.RequestId}/reject", new { adminNote = "Out of season" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await BodyAsync(response);
        Assert.Equal("Rejected", body.GetProperty("status").GetString());
        Assert.Equal("Out of season", body.GetProperty("adminNote").GetString());
        var balance = await ReadDbAsync(db => db.RewardPoints.Where(r => r.ResidentId == s.ResidentId).SumAsync(r => r.PointsEarned));
        Assert.Equal(100, balance);
    }

    // ---- fulfil --------------------------------------------------------

    [Fact]
    public async Task A_pending_request_cannot_be_handed_over()
    {
        var s = await SeedPendingAsync();
        var response = await ClientAs("admin").PostAsync($"/api/redemptions/{s.RequestId}/fulfil", null);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task An_approved_request_is_handed_over_once_only()
    {
        var s = await SeedPendingAsync();
        var admin = ClientAs("admin");
        await admin.PostAsJsonAsync($"/api/redemptions/{s.RequestId}/approve", new { });

        var first = await admin.PostAsync($"/api/redemptions/{s.RequestId}/fulfil", null);
        var second = await admin.PostAsync($"/api/redemptions/{s.RequestId}/fulfil", null);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.NotEqual(JsonValueKind.Null, (await BodyAsync(first)).GetProperty("fulfilledAt").ValueKind);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task Residents_cannot_record_a_hand_over()
    {
        var s = await SeedPendingAsync();
        var response = await ClientAs("resident", s.ResidentId).PostAsync($"/api/redemptions/{s.RequestId}/fulfil", null);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // ---- resident changes ----------------------------------------------

    [Fact]
    public async Task A_resident_cancels_their_own_pending_request()
    {
        var s = await SeedPendingAsync();
        var resident = ClientAs("resident", s.ResidentId);

        var delete = await resident.DeleteAsync($"/api/redemptions/{s.RequestId}");
        var after = await resident.GetAsync($"/api/redemptions/{s.RequestId}");

        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, after.StatusCode);
    }

    [Fact]
    public async Task A_decided_request_cannot_be_cancelled()
    {
        var s = await SeedPendingAsync();
        await ClientAs("admin").PostAsJsonAsync($"/api/redemptions/{s.RequestId}/approve", new { });

        var response = await ClientAs("resident", s.ResidentId).DeleteAsync($"/api/redemptions/{s.RequestId}");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task A_resident_cannot_open_or_cancel_someone_elses_request()
    {
        var s = await SeedPendingAsync();
        var stranger = ClientAs("resident", Guid.NewGuid());

        var get = await stranger.GetAsync($"/api/redemptions/{s.RequestId}");
        var delete = await stranger.DeleteAsync($"/api/redemptions/{s.RequestId}");

        Assert.Equal(HttpStatusCode.NotFound, get.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, delete.StatusCode);
    }

    [Fact]
    public async Task A_resident_switches_a_pending_request_to_another_item()
    {
        var s = await SeedPendingAsync(points: 100, cost: 40);
        var other = new RewardItem { Name = "Seed packet", PointsCost = 10 };
        await _factory.SeedAsync(db => { db.RewardItems.Add(other); return Task.CompletedTask; });

        var response = await ClientAs("resident", s.ResidentId)
            .PutAsJsonAsync($"/api/redemptions/{s.RequestId}", new { rewardItemId = other.Id });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await BodyAsync(response);
        Assert.Equal(10, body.GetProperty("points").GetInt32());
        Assert.Equal("Seed packet", body.GetProperty("reason").GetString());
    }
}
