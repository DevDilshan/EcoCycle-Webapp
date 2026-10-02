using Microsoft.EntityFrameworkCore;
using backend.Data;
using backend.DTOs;
using backend.Models;

namespace backend.Services;

/// <summary>
/// Reads and writes what each collector's round can take.
/// </summary>
/// <remarks>
/// Driven from the collector list rather than from the settings table, so a
/// collector who has never been configured still appears -- reporting the
/// defaults, flagged as not yet set up.
/// </remarks>
public class CollectorSettingService
{
    private const string CollectorRole = "collector";

    private readonly ApplicationDbContext _db;

    public CollectorSettingService(ApplicationDbContext db) => _db = db;

    public async Task<List<CollectorSettingDto>> GetAllAsync()
    {
        var collectors = await _db.Profiles
            .AsNoTracking()
            .Where(p => p.Role == CollectorRole)
            .OrderBy(p => p.FullName)
            .Select(p => new { p.Id, p.FullName, p.Email })
            .ToListAsync();

        var settings = await _db.CollectorSettings
            .AsNoTracking()
            .ToDictionaryAsync(c => c.CollectorId);

        return collectors.Select(c =>
        {
            var has = settings.TryGetValue(c.Id, out var s);
            return new CollectorSettingDto
            {
                CollectorId = c.Id,
                CollectorName = string.IsNullOrWhiteSpace(c.FullName) ? c.Email : c.FullName!,
                Email = c.Email,
                DailyCapacity = has ? s!.DailyCapacity : DefaultSetting.DailyCapacity,
                HandlesBulky = has ? s!.HandlesBulky : DefaultSetting.HandlesBulky,
                HandlesHazardous = has ? s!.HandlesHazardous : DefaultSetting.HandlesHazardous,
                IsConfigured = has
            };
        }).ToList();
    }

    public async Task<CollectorSettingDto?> UpdateAsync(Guid collectorId, UpdateCollectorSettingDto dto)
    {
        var isCollector = await _db.Profiles
            .AnyAsync(p => p.Id == collectorId && p.Role == CollectorRole);
        if (!isCollector) return null;

        var setting = await _db.CollectorSettings
            .FirstOrDefaultAsync(c => c.CollectorId == collectorId);

        if (setting is null)
        {
            setting = new CollectorSetting { CollectorId = collectorId };
            _db.CollectorSettings.Add(setting);
        }

        setting.DailyCapacity = dto.DailyCapacity;
        setting.HandlesBulky = dto.HandlesBulky;
        setting.HandlesHazardous = dto.HandlesHazardous;
        setting.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return (await GetAllAsync()).FirstOrDefault(c => c.CollectorId == collectorId);
    }

    /// <summary>
    /// What an unconfigured collector is assumed to be. Kept in one place so the
    /// router and the admin screen cannot disagree about it.
    /// </summary>
    public static class DefaultSetting
    {
        public const int DailyCapacity = 10;
        public const bool HandlesBulky = true;
        public const bool HandlesHazardous = false;
    }
}
