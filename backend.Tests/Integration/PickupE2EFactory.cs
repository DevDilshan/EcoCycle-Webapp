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

// Boots the real app against a REAL PostgreSQL database for the end-to-end
// workflow test. Unlike PickupApiFactory (which uses InMemory), this points the
// DbContext at the migrated test database so the full chain really persists:
//   HTTP (Flutter/React stand-in) -> ASP.NET Core -> PostgreSQL -> Agent.
// The Python agent is the one seam that cannot run in a unit test, so it is
// represented by a scripted IAgentPipelineClient that returns a fixed, valid
// classification -- the agent's own logic is covered by the Python suite and
// the live smoke script.
public class PickupE2EFactory : WebApplicationFactory<Program>
{
    private readonly string _connectionString;

    public PickupE2EFactory(string connectionString)
    {
        _connectionString = connectionString;
        Environment.SetEnvironmentVariable("SUPABASE_CONNECTION_STRING", connectionString);
        Environment.SetEnvironmentVariable("SUPABASE_URL", "http://localhost:1");
        Environment.SetEnvironmentVariable("SUPABASE_JWT_SECRET", "test-secret-not-used-by-tests");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureTestServices(services =>
        {
            // Point EF at the real migrated test database instead of InMemory.
            foreach (var d in services
                .Where(s => s.ServiceType == typeof(DbContextOptions<ApplicationDbContext>)
                         || s.ServiceType == typeof(DbContextOptions)).ToList())
                services.Remove(d);
            services.AddDbContext<ApplicationDbContext>(o => o.UseNpgsql(_connectionString));

            // Scripted agent: a fixed classification, so the workflow is deterministic.
            foreach (var d in services.Where(s => s.ServiceType == typeof(IAgentPipelineClient)).ToList())
                services.Remove(d);
            services.AddScoped<IAgentPipelineClient, ScriptedAgentClient>();

            // Header-driven auth in place of Supabase JWT.
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

    // The category the scripted agent always returns, so the test can assert it.
    public const string ClassifiedCategory = "Recyclable";

    private sealed class ScriptedAgentClient : IAgentPipelineClient
    {
        public Task<PipelineResultDto?> RunPipelineAsync(
            RunPipelineRequestDto request, CancellationToken cancellationToken = default) =>
            Task.FromResult<PipelineResultDto?>(new PipelineResultDto
            {
                Classification = new ClassificationDto
                {
                    Category = ClassifiedCategory,
                    Confidence = 0.95,
                    Reasoning = "Clear plastic bottles, a standard recyclable.",
                    ImageUsed = false,
                },
                RequiresApproval = false,
                Routing = null, // no collector assigned -> pickup stays Classified
                RawJson = "{}",
            });

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
