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

// Shared in-memory API host for route, rewards, and complaints features.
// Same swaps as PickupApiFactory: InMemory EF, TestAuthHandler, stub agent.
public class FeatureApiFactory : WebApplicationFactory<Program>
{
    private readonly string _dbName;

    public FeatureApiFactory(string namePrefix)
    {
        _dbName = $"{namePrefix}-{Guid.NewGuid()}";
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
            RemoveAll(services, typeof(DbContextOptions<ApplicationDbContext>));
            RemoveAll(services, typeof(DbContextOptions));
            services.AddDbContext<ApplicationDbContext>(o => o.UseInMemoryDatabase(_dbName));

            RemoveAll(services, typeof(IAgentPipelineClient));
            services.AddScoped<IAgentPipelineClient, StubAgentClient>();

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

public sealed class RouteApiFactory() : FeatureApiFactory("route-api");

public sealed class RewardsApiFactory() : FeatureApiFactory("rewards-api");

public sealed class ComplaintsApiFactory() : FeatureApiFactory("complaints-api");
