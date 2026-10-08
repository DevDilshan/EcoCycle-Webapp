using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using backend.Models;

namespace backend.Tests.Integration;

// Resident complaint filing and admin resolution; admin approval list access.
public class ComplaintApprovalWorkflowE2ETests : IClassFixture<ComplaintsApiFactory>
{
    private readonly ComplaintsApiFactory _factory;

    public ComplaintApprovalWorkflowE2ETests(ComplaintsApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Resident_files_complaint_admin_resolves_it()
    {
        var residentId = Guid.NewGuid();
        var pickupId = Guid.NewGuid();

        await _factory.SeedAsync(db =>
        {
            db.PickupRequests.Add(new PickupRequest
            {
                Id = pickupId,
                ResidentId = residentId,
                Description = "Mixed waste",
                PreferredDate = DateTime.UtcNow.AddDays(1),
                Status = PickupStatus.Completed,
            });
            return Task.CompletedTask;
        });

        var resident = Client("resident", residentId);
        var create = await resident.PostAsJsonAsync("/api/complaints", new
        {
            pickupRequestId = pickupId,
            description = "The crew missed my bags on the scheduled day.",
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var complaintId = (await create.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        var admin = Client("admin");
        var update = await admin.PutAsJsonAsync($"/api/complaints/{complaintId}", new
        {
            status = "Resolved",
            adminNotes = "Follow-up collection booked for tomorrow.",
        });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        var resolved = await update.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Resolved", resolved.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Admin_lists_pending_approvals_after_seed()
    {
        await _factory.SeedAsync(db =>
        {
            var pickup = new PickupRequest
            {
                Description = "Uncertain waste",
                PreferredDate = DateTime.UtcNow.AddDays(2),
                Status = PickupStatus.Classified,
            };
            db.PickupRequests.Add(pickup);
            db.ApprovalRequests.Add(new ApprovalRequest
            {
                PickupRequestId = pickup.Id,
                FlagReason = "Low confidence",
                Status = ApprovalStatus.Pending,
            });
            return Task.CompletedTask;
        });

        var admin = Client("admin");
        var list = await admin.GetAsync("/api/approvals?status=Pending");
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        var page = await list.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(page.GetProperty("totalCount").GetInt32() >= 1);
    }

    private HttpClient Client(string role, Guid? sub = null)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.RoleHeader, role);
        client.DefaultRequestHeaders.Add(TestAuthHandler.SubHeader, (sub ?? Guid.NewGuid()).ToString());
        return client;
    }
}
