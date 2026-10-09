using System.Net.Http.Json;
using backend.Data;
using backend.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/profiles")]
[Authorize(Roles = "admin")]
public class ProfilesController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ProfileRoleCache _roleCache;
    private readonly IHttpClientFactory _httpClientFactory;

    public ProfilesController(
        ApplicationDbContext db,
        ProfileRoleCache roleCache,
        IHttpClientFactory httpClientFactory)
    {
        _db = db;
        _roleCache = roleCache;
        _httpClientFactory = httpClientFactory;
    }

    [HttpGet]
    public async Task<IActionResult> GetList([FromQuery] ProfileQueryParams query)
    {
        var q = _db.Profiles.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.Role))
        {
            // profiles.role is a PostgreSQL enum (user_role); compare labels directly — lower() is invalid on enums
            var role = query.Role.Trim().ToLowerInvariant();
            q = role switch
            {
                "resident" => q.Where(p => p.Role == "resident" || p.Role == "user"),
                "collector" => q.Where(p => p.Role == "collector"),
                "admin" => q.Where(p => p.Role == "admin"),
                _ => q.Where(p => p.Role == role),
            };
        }

        var items = await q
            .OrderBy(p => p.FullName ?? p.Email)
            .Select(p => new ProfileResponseDto
            {
                Id = p.Id,
                Email = p.Email,
                FullName = p.FullName,
                Role = p.Role,
                CreatedAt = p.CreatedAt,
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPatch("{id:guid}/role")]
    public async Task<IActionResult> UpdateRole(Guid id, [FromBody] UpdateProfileRoleDto dto)
    {
        if (dto is null || string.IsNullOrWhiteSpace(dto.Role))
            return BadRequest(new { message = "Role is required." });

        var normalized = dto.Role.Trim().ToLowerInvariant();
        if (normalized is not ("admin" or "collector" or "resident"))
        {
            return BadRequest(new
            {
                message = "Role must be admin, collector, or resident.",
            });
        }

        var profile = await _db.Profiles.FirstOrDefaultAsync(p => p.Id == id);
        if (profile is null)
            return NotFound(new { message = "User not found." });

        var current = NormalizeStoredRole(profile.Role);
        if (current == normalized)
        {
            return Ok(new ProfileResponseDto
            {
                Id = profile.Id,
                Email = profile.Email,
                FullName = profile.FullName,
                Role = profile.Role,
                CreatedAt = profile.CreatedAt,
            });
        }

        if (current == "admin" && normalized != "admin")
        {
            var adminCount = await _db.Profiles.CountAsync(p => p.Role == "admin");
            if (adminCount <= 1)
            {
                return BadRequest(new
                {
                    message = "Cannot change the role of the last admin account.",
                });
            }
        }

        var updatedAt = DateTime.UtcNow;
        if (_db.Database.IsRelational())
        {
            // EF would parameterize role as text; Postgres requires user_role.
            await _db.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE profiles SET role = {normalized}::user_role, updated_at = {updatedAt} WHERE id = {id}");
            profile.Role = normalized;
            profile.UpdatedAt = updatedAt;
        }
        else
        {
            profile.Role = normalized;
            profile.UpdatedAt = updatedAt;
            await _db.SaveChangesAsync();
        }

        _roleCache.Invalidate(id);
        await TrySyncSupabaseRoleAsync(id, normalized);

        return Ok(new ProfileResponseDto
        {
            Id = profile.Id,
            Email = profile.Email,
            FullName = profile.FullName,
            Role = profile.Role,
            CreatedAt = profile.CreatedAt,
        });
    }

    private static string NormalizeStoredRole(string? role) =>
        role?.ToLowerInvariant() switch
        {
            "admin" => "admin",
            "collector" => "collector",
            "user" => "resident",
            "resident" => "resident",
            _ => "resident",
        };

    private async Task TrySyncSupabaseRoleAsync(Guid userId, string role)
    {
        var supabaseUrl = Environment.GetEnvironmentVariable("SUPABASE_URL")?.TrimEnd('/');
        var serviceKey = Environment.GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY");
        if (string.IsNullOrWhiteSpace(supabaseUrl) || string.IsNullOrWhiteSpace(serviceKey))
            return;

        var client = _httpClientFactory.CreateClient();
        using var request = new HttpRequestMessage(
            HttpMethod.Put,
            $"{supabaseUrl}/auth/v1/admin/users/{userId}");
        request.Headers.Add("apikey", serviceKey);
        request.Headers.Add("Authorization", $"Bearer {serviceKey}");
        request.Content = JsonContent.Create(new
        {
            user_metadata = new { role },
        });

        try
        {
            await client.SendAsync(request);
        }
        catch
        {
            // Authoritative role is in profiles; metadata sync is best-effort for clients.
        }
    }
}
