using System.Net;
using System.Net.Http.Json;
using backend.Models;

namespace backend.Tests.Integration;

public class ProfilesControllerTests : IClassFixture<ComplaintsApiFactory>
{
    private readonly ComplaintsApiFactory _factory;

    public ProfilesControllerTests(ComplaintsApiFactory factory) => _factory = factory;

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
    public async Task UpdateRole_as_resident_returns_403()
    {
        var target = Guid.NewGuid();
        var client = ClientAs("resident");
        var response = await client.PatchAsJsonAsync($"/api/profiles/{target}/role", new { role = "collector" });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task UpdateRole_changes_profile_and_blocks_last_admin_demotion()
    {
        var adminId = Guid.NewGuid();
        var residentId = Guid.NewGuid();
        await _factory.SeedAsync(db =>
        {
            db.Profiles.AddRange(
                new Profile
                {
                    Id = adminId,
                    Email = "admin@test.local",
                    FullName = "Admin",
                    Role = "admin",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                },
                new Profile
                {
                    Id = residentId,
                    Email = "resident@test.local",
                    FullName = "Resi",
                    Role = "resident",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                });
            return Task.CompletedTask;
        });

        var client = ClientAs("admin", adminId);

        var promote = await client.PatchAsJsonAsync($"/api/profiles/{residentId}/role", new { role = "collector" });
        Assert.Equal(HttpStatusCode.OK, promote.StatusCode);
        var promoted = await promote.Content.ReadFromJsonAsync<ProfileRoleResponse>();
        Assert.Equal("collector", promoted!.Role);

        var demoteLastAdmin = await client.PatchAsJsonAsync($"/api/profiles/{adminId}/role", new { role = "resident" });
        Assert.Equal(HttpStatusCode.BadRequest, demoteLastAdmin.StatusCode);
    }

    private sealed class ProfileRoleResponse
    {
        public Guid Id { get; set; }
        public string Role { get; set; } = string.Empty;
    }
}
