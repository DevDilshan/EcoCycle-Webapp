using System.Net;
using System.Net.Http.Json;
using backend.Models;

namespace backend.Tests.Integration;

public class ApprovalsControllerTests : IClassFixture<ComplaintsApiFactory>
{
    private readonly ComplaintsApiFactory _factory;

    public ApprovalsControllerTests(ComplaintsApiFactory factory) => _factory = factory;

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
    public async Task GetList_without_authentication_returns_401()
    {
        var client = ClientAs(role: null);
        var response = await client.GetAsync("/api/approvals");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetList_as_resident_is_forbidden_admin_only()
    {
        var client = ClientAs("resident");
        var response = await client.GetAsync("/api/approvals");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetList_as_admin_returns_200()
    {
        var client = ClientAs("admin");
        var response = await client.GetAsync("/api/approvals?status=Pending");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Approve_unknown_id_returns_404()
    {
        var client = ClientAs("admin");
        var response = await client.PostAsJsonAsync($"/api/approvals/{Guid.NewGuid()}/approve", new { });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Reject_without_reason_returns_400()
    {
        var approvalId = Guid.NewGuid();
        await _factory.SeedAsync(db =>
        {
            var pickup = new PickupRequest
            {
                Description = "Mixed waste",
                PreferredDate = DateTime.UtcNow.AddDays(2),
                Status = PickupStatus.Classified,
            };
            db.PickupRequests.Add(pickup);
            db.ApprovalRequests.Add(new ApprovalRequest
            {
                Id = approvalId,
                PickupRequestId = pickup.Id,
                FlagReason = "Low confidence",
                Status = ApprovalStatus.Pending,
            });
            return Task.CompletedTask;
        });

        var client = ClientAs("admin");
        var response = await client.PostAsJsonAsync($"/api/approvals/{approvalId}/reject", new { reason = "" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
