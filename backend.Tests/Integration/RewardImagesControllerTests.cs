using System.Net;

namespace backend.Tests.Integration;

public class RewardImagesControllerTests(RewardsApiFactory factory) : IClassFixture<RewardsApiFactory>
{
    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData("resident", HttpStatusCode.Forbidden)]
    [InlineData("collector", HttpStatusCode.Forbidden)]
    public async Task Only_admins_can_upload_reward_images(string? role, HttpStatusCode expected)
    {
        using var client = factory.CreateClient();
        if (role != null) {
            client.DefaultRequestHeaders.Add(TestAuthHandler.RoleHeader, role);
            client.DefaultRequestHeaders.Add(TestAuthHandler.SubHeader, Guid.NewGuid().ToString());
        }
        using var body = new MultipartFormDataContent();
        body.Add(new ByteArrayContent([1,2,3]), "file", "fake.png");
        Assert.Equal(expected, (await client.PostAsync("/api/reward-items/image", body)).StatusCode);
    }
}
