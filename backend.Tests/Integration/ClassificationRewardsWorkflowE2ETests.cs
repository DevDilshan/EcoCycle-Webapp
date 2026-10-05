using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using backend.Models;

namespace backend.Tests.Integration;

// Classification validation (rules engine) then reward history visibility.
public class ClassificationRewardsWorkflowE2ETests : IClassFixture<RewardsApiFactory>
{
    private readonly RewardsApiFactory _factory;

    public ClassificationRewardsWorkflowE2ETests(RewardsApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Admin_validates_classified_pickup_then_resident_sees_reward_history()
    {
        var residentId = Guid.NewGuid();
        var pickupId = Guid.NewGuid();

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
            db.PickupRequests.Add(new PickupRequest
            {
                Id = pickupId,
                ResidentId = residentId,
                Description = "Plastic bottles",
                PreferredDate = DateTime.UtcNow.AddDays(2),
                Status = PickupStatus.Classified,
            });
            db.WasteClassifications.Add(new WasteClassification
            {
                PickupRequestId = pickupId,
                Category = WasteCategory.Recyclable,
                Confidence = 0.92,
                Reasoning = "Clear recyclables",
            });
            return Task.CompletedTask;
        });

        var admin = Client("admin");
        var validate = await admin.PostAsync($"/api/rewards/validate/{pickupId}", content: null);
        Assert.Equal(HttpStatusCode.OK, validate.StatusCode);
        var validation = await validate.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(pickupId, validation.GetProperty("pickupRequestId").GetGuid());

        var award = await admin.PostAsJsonAsync("/api/rewards", new
        {
            residentId,
            pickupRequestId = pickupId,
            pointsEarned = 5,
            reason = "Recyclable collection credit",
        });
        Assert.Equal(HttpStatusCode.Created, award.StatusCode);

        var resident = Client("resident", residentId);
        var history = await resident.GetAsync($"/api/rewards/{residentId}/history");
        Assert.Equal(HttpStatusCode.OK, history.StatusCode);
        var body = await history.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("currentBalance").GetInt32() >= 5);
    }

    private HttpClient Client(string role, Guid? sub = null)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.RoleHeader, role);
        client.DefaultRequestHeaders.Add(TestAuthHandler.SubHeader, (sub ?? Guid.NewGuid()).ToString());
        return client;
    }
}
