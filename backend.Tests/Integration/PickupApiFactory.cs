using backend.Data;
using backend.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace backend.Tests.Integration;

// Boots the real ASP.NET Core app in-memory for API integration tests, with
// three swaps so no external service is touched:
//   * PostgreSQL              -> EF Core InMemory
//   * Supabase JWT bearer     -> TestAuthHandler (header-driven roles)
//   * Python agent HTTP client-> a stub that always reports "service down"
// Startup still runs for real (routing, model validation, the [Authorize]
// pipeline), which is the point: these tests cover the HTTP edge, not the
// service internals that PickupRequestServiceTests already cover.
public class PickupApiFactory : WebApplicationFactory<Program>
{
    private readonly string _dbName = $"pickup-api-{Guid.NewGuid()}";

    public PickupApiFactory()
    {
        // Program.cs refuses to start without these. The values only need to be
        // present and well-formed -- the connection is never opened (EF is
        // swapped for InMemory) and the JWKS fetch is caught and ignored.
        Environment.SetEnvironmentVariable("SUPABASE_CONNECTION_STRING",
            "Host=localhost;Database=test;Username=test;Password=test");
        Environment.SetEnvironmentVariable("SUPABASE_URL", "http://localhost:1");
        Environment.SetEnvironmentVariable("SUPABASE_JWT_SECRET", "test-secret-not-used-by-tests");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureTestServices(services =>
        {
            // Swap PostgreSQL for a per-factory in-memory database.
            RemoveAll(services, typeof(DbContextOptions<ApplicationDbContext>));
            RemoveAll(services, typeof(DbContextOptions));
            services.AddDbContext<ApplicationDbContext>(o => o.UseInMemoryDatabase(_dbName));

            // Swap the Python agent client for a stub (no outbound HTTP).
            RemoveAll(services, typeof(IAgentPipelineClient));
            services.AddScoped<IAgentPipelineClient, StubAgentClient>();

            // Swap Supabase JWT for the header-driven test scheme, and make it
            // the default so [Authorize] challenges unauthenticated calls with 401.
            services.AddAuthentication(TestAuthHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
            services.PostConfigure<AuthenticationOptions>(o =>
            {
                o.DefaultScheme = TestAuthHandler.SchemeName;
                o.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                o.DefaultChallengeScheme = TestAuthHandler.SchemeName;
            });
        });
    }

    // Runs an action against a fresh DbContext scope, e.g. to seed a zone.
    public async Task SeedAsync(Func<ApplicationDbContext, Task> seed)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await seed(db);
        await db.SaveChangesAsync();
    }

    private static void RemoveAll(IServiceCollection services, Type serviceType)
    {
        foreach (var d in services.Where(s => s.ServiceType == serviceType).ToList())
            services.Remove(d);
    }

    private sealed class StubAgentClient : IAgentPipelineClient
    {
        public Task<PipelineResultDto?> RunPipelineAsync(RunPipelineRequestDto r, CancellationToken c = default) =>
            Task.FromResult<PipelineResultDto?>(null);
        public Task<RoutingDto?> RouteApprovedPickupAsync(RouteApprovedPickupRequestDto r, CancellationToken c = default) =>
            Task.FromResult<RoutingDto?>(null);
        public Task<RoutingDto?> ChooseSlotAsync(RoutingContextDto r, CancellationToken c = default) =>
            Task.FromResult<RoutingDto?>(null);
        public Task<MissedExplanationDto?> ExplainMissedAsync(ExplainMissedRequestDto r, CancellationToken c = default) =>
            Task.FromResult<MissedExplanationDto?>(null);
        public Task<DecisionExplanationDto?> ExplainDecisionAsync(ExplainDecisionRequestDto r, CancellationToken c = default) =>
            Task.FromResult<DecisionExplanationDto?>(null);
        public Task<ImageValidationDto?> ValidateImageAsync(ValidateImageRequestDto r, CancellationToken c = default) =>
            Task.FromResult<ImageValidationDto?>(null);
    }
}
