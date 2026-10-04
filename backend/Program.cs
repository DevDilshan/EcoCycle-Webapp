using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using backend.Data;
using backend.Services;

// Repo-root .env first, then backend/.env wins (pool size, agent URL, keys).
LoadEnvFile(Path.Combine(Directory.GetCurrentDirectory(), "..", ".env"));
LoadEnvFile(Path.Combine(Directory.GetCurrentDirectory(), ".env"));

var builder = WebApplication.CreateBuilder(args);

var connectionStringSupabase = Environment.GetEnvironmentVariable("SUPABASE_CONNECTION_STRING")
    ?? throw new InvalidOperationException("SUPABASE_CONNECTION_STRING not found in environment/.env file");

// One data source for EF and for the raw health check, so the app holds a
// single connection pool. Supabase's pooler counts every client against a small
// limit, and two pools reach it twice as fast.
builder.Services.AddSingleton(NpgsqlDataSource.Create(connectionStringSupabase));

builder.Services.AddDbContext<ApplicationDbContext>((services, options) =>
    options.UseNpgsql(services.GetRequiredService<NpgsqlDataSource>()));

builder.Services.AddScoped<ZoneService>();
builder.Services.AddScoped<RouteAssignmentService>();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(options =>
{
    var scheme = new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Paste ONLY the JWT (no 'Bearer ' prefix).",
        Reference = new Microsoft.OpenApi.Models.OpenApiReference
        {
            Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
            Id = "Bearer"
        }
    };
    options.AddSecurityDefinition("Bearer", scheme);
    options.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        { scheme, Array.Empty<string>() }
    });
});

builder.Services.AddControllers();
builder.Services.AddHttpClient();
builder.Services.AddMemoryCache();

// Pickup requests
builder.Services.AddScoped<backend.Services.IPickupRequestService, backend.Services.PickupRequestService>();

// Recycling rewards
builder.Services.AddScoped<backend.Services.IRewardService, backend.Services.RewardService>();
builder.Services.AddScoped<backend.Services.IRedemptionService, backend.Services.RedemptionService>();
builder.Services.AddScoped<backend.Services.IRewardItemService, backend.Services.RewardItemService>();
builder.Services.AddScoped<backend.Services.IValidationService, backend.Services.ValidationService>();

// Complaints & approvals
builder.Services.AddScoped<backend.Services.IComplaintService, backend.Services.ComplaintService>();
builder.Services.AddScoped<backend.Services.IApprovalService, backend.Services.ApprovalService>();

// Python agent service (Classifier -> Validator -> Routing -> Notifier).
// A short timeout on purpose: the pipeline makes several LLM calls, but a
// resident submitting a pickup must not wait on them indefinitely. If it is
// exceeded the client returns null and the caller degrades to Pending.
var agentServiceUrl = Environment.GetEnvironmentVariable("AGENT_SERVICE_URL")
    ?? "http://127.0.0.1:8000"; // not "localhost": uvicorn listens on IPv4 only, and
                                // Windows spends ~2s trying ::1 first
var agentServiceKey = Environment.GetEnvironmentVariable("INTERNAL_API_KEY");

if (string.IsNullOrWhiteSpace(agentServiceKey))
    Console.WriteLine(
        "[WARN] INTERNAL_API_KEY is not set. Calls to the agent service will be " +
        "rejected with 401; pickups will fall back to manual classification.");

builder.Services.AddHttpClient<backend.Services.IAgentPipelineClient, backend.Services.AgentPipelineClient>(client =>
{
    client.BaseAddress = new Uri(agentServiceUrl);
    client.Timeout = TimeSpan.FromMinutes(3);
    client.DefaultRequestHeaders.Add("X-Internal-Key", agentServiceKey ?? string.Empty);
});

// Compliance & classification (Student 3 rules → auto-create approval tasks)
builder.Services.AddScoped<backend.Services.IComplianceService, backend.Services.ComplianceService>();
builder.Services.AddScoped<backend.Services.CollectorSettingService>();
builder.Services.AddScoped<backend.Services.RoutingOptionBuilder>();
builder.Services.AddScoped<backend.Services.PickupSchedulingService>();

var corsOriginsEnv = Environment.GetEnvironmentVariable("CORS_ALLOWED_ORIGINS");
var corsOrigins = string.IsNullOrWhiteSpace(corsOriginsEnv)
    ? new[] { "http://localhost:5173" }
    : corsOriginsEnv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins(corsOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var supabaseUrl = builder.Configuration["Supabase:Url"];
if (string.IsNullOrWhiteSpace(supabaseUrl))
    supabaseUrl = Environment.GetEnvironmentVariable("SUPABASE_URL");

var jwtSecret = builder.Configuration["Supabase:JwtSecret"];
if (string.IsNullOrWhiteSpace(jwtSecret))
    jwtSecret = Environment.GetEnvironmentVariable("SUPABASE_JWT_SECRET");

if (string.IsNullOrWhiteSpace(supabaseUrl) || string.IsNullOrWhiteSpace(jwtSecret))
{
    throw new InvalidOperationException(
        "Supabase auth config is missing. Set SUPABASE_URL and SUPABASE_JWT_SECRET in backend/.env " +
        "(or Supabase:Url and Supabase:JwtSecret in appsettings.Development.json).");
}

// Collect the keys we'll accept: legacy HS256 secret + Supabase's asymmetric (ES256) public keys
var signingKeys = new List<SecurityKey>
{
    new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)) // legacy HS256 / service tokens
};

var jwksUrl = $"{supabaseUrl.TrimEnd('/')}/auth/v1/.well-known/jwks.json";
try
{
    using var http = new HttpClient();
    var jwksJson = http.GetStringAsync(jwksUrl).GetAwaiter().GetResult();
    foreach (var key in new JsonWebKeySet(jwksJson).GetSigningKeys())
        signingKeys.Add(key); // ES256 public keys
}
catch (Exception ex)
{
    Console.WriteLine($"[WARN] Could not load Supabase JWKS from {jwksUrl}: {ex.Message}");
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = $"{supabaseUrl.TrimEnd('/')}/auth/v1",
            ValidateAudience = true,
            ValidAudience = "authenticated",
            ValidateLifetime = true,
            IssuerSigningKeys = signingKeys,
        };

        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                if (context.Principal?.Identity is not ClaimsIdentity identity) return;

                // The role comes from the profiles table, not from the token.
                // A token's user_metadata is written by the user -- at sign-up
                // or later through updateUser -- so trusting its "role" let any
                // account call itself an admin. A profile's role can only be
                // changed by an admin (row-level security on profiles).
                var role = "resident";
                if (Guid.TryParse(context.Principal.FindFirst("sub")?.Value, out var userId))
                {
                    var services = context.HttpContext.RequestServices;
                    var cache = services.GetRequiredService<IMemoryCache>();
                    role = await cache.GetOrCreateAsync($"role:{userId}", async entry =>
                    {
                        // Cached role lookup: each miss opens a pooler connection.
                        // Supabase session mode allows ~15 clients for the whole project.
                        entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);

                        var db = services.GetRequiredService<NpgsqlDataSource>();
                        await using var command = db.CreateCommand(
                            "SELECT role::text FROM public.profiles WHERE id = $1");
                        command.Parameters.AddWithValue(userId);
                        return NormalizeRole(await command.ExecuteScalarAsync() as string);
                    }) ?? "resident";
                }

                identity.AddClaim(new Claim(ClaimTypes.Role, role));
            },
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Admin", policy => policy.RequireRole("admin"));
    options.AddPolicy("User", policy => policy.RequireAuthenticatedUser());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Frontend");
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/health", async (NpgsqlDataSource db) =>
{
    await using var connection = await db.OpenConnectionAsync();
    return Results.Ok(new { status = "healthy", database = "connected" });
});

// Local dev: verify agent URL + shared secret (no auth required).
app.MapGet("/api/health/agent", async (ILogger<Program> logger) =>
{
    var agentUrl = (Environment.GetEnvironmentVariable("AGENT_SERVICE_URL")
                    ?? "http://127.0.0.1:8000").TrimEnd('/');
    var key = Environment.GetEnvironmentVariable("INTERNAL_API_KEY");
    var keyConfigured = !string.IsNullOrWhiteSpace(key);

    try
    {
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(8) };
        var health = await http.GetAsync($"{agentUrl}/health");
        int? pipelineStatus = null;
        if (keyConfigured && health.IsSuccessStatusCode)
        {
            using var probe = new HttpRequestMessage(HttpMethod.Post, $"{agentUrl}/run-pipeline");
            probe.Headers.Add("X-Internal-Key", key);
            probe.Content = JsonContent.Create(new
            {
                description = "EcoCycle connectivity probe — mixed recyclables",
                resident_zone_id = Guid.Empty.ToString(),
                routing_context = new { slots = Array.Empty<object>() },
            });
            var pipe = await http.SendAsync(probe);
            pipelineStatus = (int)pipe.StatusCode;
        }

        return Results.Ok(new
        {
            agentUrl,
            internalKeyConfigured = keyConfigured,
            healthStatus = (int)health.StatusCode,
            runPipelineStatus = pipelineStatus,
            ok = health.IsSuccessStatusCode && pipelineStatus is 200,
        });
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Agent health check failed for {AgentUrl}", agentUrl);
        return Results.Ok(new
        {
            agentUrl,
            internalKeyConfigured = keyConfigured,
            ok = false,
            error = ex.Message,
        });
    }
});

app.MapGet("/api/me", (ClaimsPrincipal user) =>
{
    if (user.Identity?.IsAuthenticated != true)
        return Results.Unauthorized();

    return Results.Ok(new
    {
        id = user.FindFirstValue("sub"),
        email = user.FindFirstValue("email"),
        role = user.FindFirstValue(ClaimTypes.Role) ?? "resident",
    });
}).RequireAuthorization();

app.MapGet("/api/admin", () => Results.Ok(new { message = "Admin access granted" }))
    .RequireAuthorization("Admin");

app.MapControllers();

app.Run();

static void LoadEnvFile(string path)
{
    if (!File.Exists(path)) return;

    foreach (var line in File.ReadAllLines(path))
    {
        var trimmed = line.Trim();
        if (string.IsNullOrEmpty(trimmed) || trimmed.StartsWith('#')) continue;

        var separator = trimmed.IndexOf('=');
        if (separator <= 0) continue;

        var key = trimmed[..separator].Trim();
        var value = trimmed[(separator + 1)..].Trim();

        if (value.StartsWith('"') && value.EndsWith('"'))
            value = value[1..^1];

        Environment.SetEnvironmentVariable(key, value);
    }
}

static string NormalizeRole(string? role) =>
    role?.ToLowerInvariant() switch
    {
        "admin" => "admin",
        "collector" => "collector",
        "resident" => "resident",
        "user" => "resident",
        _ => "resident",
    };
