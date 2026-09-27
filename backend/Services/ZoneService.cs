using Microsoft.EntityFrameworkCore;
using backend.Data;
using backend.DTOs;
using backend.Models;

namespace backend.Services;

public class ZoneService
{
    private readonly ApplicationDbContext _context;

    public ZoneService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<ZoneDto>> GetAllZonesAsync()
    {
        return await _context.Zones
            .AsNoTracking()
            .OrderBy(z => z.Name)
            .Select(z => MapToDto(z))
            .ToListAsync();
    }

    /// <summary>
    /// Active zones that can be shown on the public map.
    /// </summary>
    /// <remarks>
    /// Only zones with both coordinates are returned: one without them cannot be
    /// placed, and sending it would leave the caller to filter anyway. Inactive
    /// zones are excluded because the page states these are areas we serve now.
    /// </remarks>
    public async Task<List<PublicZoneDto>> GetPublicZonesAsync()
    {
        return await _context.Zones
            .AsNoTracking()
            .Where(z => z.IsActive && z.Latitude != null && z.Longitude != null)
            .OrderBy(z => z.Name)
            .Select(z => new PublicZoneDto
            {
                Id = z.Id,
                Name = z.Name,
                Latitude = z.Latitude!.Value,
                Longitude = z.Longitude!.Value,
            })
            .ToListAsync();
    }

    public async Task<ZoneDto?> GetZoneByIdAsync(Guid id)
    {
        var zone = await _context.Zones
            .AsNoTracking()
            .FirstOrDefaultAsync(z => z.Id == id);

        return zone is null ? null : MapToDto(zone);
    }

    public async Task<ZoneDto> CreateZoneAsync(CreateZoneDto dto)
    {
        var zone = new Zone
        {
            Name = dto.Name,
            Description = dto.Description,
            AssignedCollectorId = dto.AssignedCollectorId,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            IsActive = dto.IsActive,
            CreatedAt = DateTime.UtcNow
        };

        _context.Zones.Add(zone);
        await _context.SaveChangesAsync();

        return MapToDto(zone);
    }

    public async Task<ZoneDto?> UpdateZoneAsync(Guid id, CreateZoneDto dto)
    {
        var zone = await _context.Zones.FirstOrDefaultAsync(z => z.Id == id);
        if (zone is null)
        {
            return null;
        }

        zone.Name = dto.Name;
        zone.Description = dto.Description;
        zone.AssignedCollectorId = dto.AssignedCollectorId;
        zone.Latitude = dto.Latitude;
        zone.Longitude = dto.Longitude;
        zone.IsActive = dto.IsActive;
        zone.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return MapToDto(zone);
    }

    public async Task<bool> DeleteZoneAsync(Guid id)
    {
        var zone = await _context.Zones.FirstOrDefaultAsync(z => z.Id == id);
        if (zone is null)
        {
            return false;
        }

        _context.Zones.Remove(zone);
        await _context.SaveChangesAsync();

        return true;
    }

    private static ZoneDto MapToDto(Zone zone) => new()
    {
        Id = zone.Id,
        Name = zone.Name,
        Description = zone.Description,
        AssignedCollectorId = zone.AssignedCollectorId,
        Latitude = zone.Latitude,
        Longitude = zone.Longitude,
        IsActive = zone.IsActive,
        UpdatedAt = zone.UpdatedAt,
        CreatedAt = zone.CreatedAt
    };
}
