using backend.Data;
using backend.DTOs;
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

    public ProfilesController(ApplicationDbContext db) => _db = db;

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
}
