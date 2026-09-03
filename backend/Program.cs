using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using backend.Data;

LoadEnvFile(Path.Combine(Directory.GetCurrentDirectory(), ".env"));
LoadEnvFile(Path.Combine(Directory.GetCurrentDirectory(), "..", ".env"));

var builder = WebApplication.CreateBuilder(args);

var connectionStringSupabase = Environment.GetEnvironmentVariable("SUPABASE_CONNECTION_STRING")
    ?? throw new InvalidOperationException("SUPABASE_CONNECTION_STRING not found in environment/.env file");

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionStringSupabase));

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

// Pickup requests
builder.Services.AddScoped<backend.Services.IPickupRequestService, backend.Services.PickupRequestService>();

// Recycling rewards
builder.Services.AddScoped<backend.Services.IRewardService, backend.Services.RewardService>();

// Complaints & approvals
builder.Services.AddScoped<backend.Services.IComplaintService, backend.Services.ComplaintService>();
builder.Services.AddScoped<backend.Services.IApprovalService, backend.Services.ApprovalService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var connectionString = builder.Configuration.GetConnectionString("Supabase");
if (string.IsNullOrWhiteSpace(connectionString))
    connectionString = Environment.GetEnvironmentVariable("SUPABASE_CONNECTION_STRING");

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Supabase connection string is missing. Copy .env.example to .env in the project root " +
        "and set SUPABASE_CONNECTION_STRING (or ConnectionStrings:Supabase in appsettings.Development.json).");
}

builder.Services.AddSingleton(NpgsqlDataSource.Create(connectionString));

var supabaseUrl = builder.Configuration["Supabase:Url"];
if (string.IsNullOrWhiteSpace(supabaseUrl))
    supabaseUrl = Environment.GetEnvironmentVariable("SUPABASE_URL");

var jwtSecret = builder.Configuration["Supabase:JwtSecret"];
if (string.IsNullOrWhiteSpace(jwtSecret))
    jwtSecret = Environment.GetEnvironmentVariable("SUPABASE_JWT_SECRET");

if (string.IsNullOrWhiteSpace(supabaseUrl) || string.IsNullOrWhiteSpace(jwtSecret))
{
    throw new InvalidOperationException(
        "Supabase auth config is missing. Set SUPABASE_URL and SUPABASE_JWT_SECRET in .env " +
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
            OnTokenValidated = context =>
            {
                if (context.Principal is null) return Task.CompletedTask;

                var identity = context.Principal.Identity as ClaimsIdentity;
                if (identity is null) return Task.CompletedTask;

                var role = ExtractRole(context.Principal);
                if (!string.IsNullOrEmpty(role))
                {
                    identity.AddClaim(new Claim(ClaimTypes.Role, role.ToLowerInvariant()));
                }

                return Task.CompletedTask;
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

app.MapGet("/api/me", (ClaimsPrincipal user) =>
{
    if (user.Identity?.IsAuthenticated != true)
        return Results.Unauthorized();

    return Results.Ok(new
    {
        id = user.FindFirstValue("sub"),
        email = user.FindFirstValue("email"),
        role = user.FindFirstValue(ClaimTypes.Role) ?? "user",
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

static string ExtractRole(ClaimsPrincipal principal)
{
    var roleClaim = principal.FindFirst("role")?.Value;
    if (IsAppRole(roleClaim)) return roleClaim!;

    var appMetadata = principal.FindFirst("app_metadata")?.Value;
    if (!string.IsNullOrEmpty(appMetadata))
    {
        var role = ParseRoleFromJson(appMetadata);
        if (IsAppRole(role)) return role!;
    }

    var userMetadata = principal.FindFirst("user_metadata")?.Value;
    if (!string.IsNullOrEmpty(userMetadata))
    {
        var role = ParseRoleFromJson(userMetadata);
        if (IsAppRole(role)) return role!;
    }

    return "user";
}

static string? ParseRoleFromJson(string json)
{
    try
    {
        using var doc = JsonDocument.Parse(json);
        if (doc.RootElement.TryGetProperty("role", out var role))
            return role.GetString();
    }
    catch (JsonException) { }

    return null;
}

static bool IsAppRole(string? role) =>
    role?.ToLowerInvariant() is "admin" or "resident" or "collector" or "user";
