using Microsoft.EntityFrameworkCore;
using backend.Data;
using backend.DTOs;
using backend.Models;

namespace backend.Services;

/// <summary>
/// Works out every legal way a pickup could be collected, so the routing agent
/// chooses between real options instead of inventing one.
/// </summary>
/// <remarks>
/// The hard constraints live here, in code, because they must never be got
/// wrong: a hazardous load on an unlicensed vehicle, a bulky item on a truck
/// with no lift, or a collector given more stops than their day holds. What is
/// left for the agent is the genuinely debatable part -- the resident asked for
/// Thursday, the zone runs Tuesday and Friday, one collector is nearly full and
/// the item is hazardous, so which slot is actually best?
/// </remarks>
public class RoutingOptionBuilder
{
    private const string CollectorRole = "collector";

    /// <summary>How far ahead to look for a slot.</summary>
    private const int HorizonDays = 14;

    private readonly ApplicationDbContext _db;

    public RoutingOptionBuilder(ApplicationDbContext db) => _db = db;

    public async Task<RoutingContextDto> BuildAsync(
        Guid zoneId,
        WasteCategory category,
        DateTime? preferredDate)
    {
        var today = DateTime.UtcNow.Date;

        var zone = await _db.Zones.AsNoTracking().FirstOrDefaultAsync(z => z.Id == zoneId);
        if (zone is null)
        {
            return new RoutingContextDto { Category = category.ToString() };
        }

        // Who may take it at all. The zone's own collector first; everyone else
        // only when the zone has nobody, so work stays inside its zone.
        var collectorIds = zone.AssignedCollectorId is not null
            ? [zone.AssignedCollectorId.Value]
            : await _db.Profiles.AsNoTracking()
                .Where(p => p.Role == CollectorRole)
                .Select(p => p.Id)
                .ToListAsync();

        if (collectorIds.Count == 0) return Empty(zone, category);

        var collectors = await _db.Profiles.AsNoTracking()
            .Where(p => collectorIds.Contains(p.Id))
            .Select(p => new { p.Id, p.FullName, p.Email })
            .ToListAsync();

        var settings = await _db.CollectorSettings.AsNoTracking()
            .Where(c => collectorIds.Contains(c.CollectorId))
            .ToDictionaryAsync(c => c.CollectorId);

        // What is already booked, per collector per day, across the horizon.
        var horizonEnd = today.AddDays(HorizonDays);
        var booked = await _db.RouteAssignments.AsNoTracking()
            .Where(r => collectorIds.Contains(r.CollectorId)
                && r.ScheduledDate >= today
                && r.ScheduledDate < horizonEnd
                && r.CompletionStatus == RouteCompletionStatus.Pending)
            .Select(r => new { r.CollectorId, r.ScheduledDate })
            .ToListAsync();

        var load = booked
            .GroupBy(b => (b.CollectorId, b.ScheduledDate.Date))
            .ToDictionary(g => g.Key, g => g.Count());

        var options = new List<RoutingOptionDto>();

        foreach (var collector in collectors)
        {
            var hasSetting = settings.TryGetValue(collector.Id, out var setting);
            var capacity = hasSetting ? setting!.DailyCapacity : CollectorSettingService.DefaultSetting.DailyCapacity;
            var bulky = hasSetting ? setting!.HandlesBulky : CollectorSettingService.DefaultSetting.HandlesBulky;
            var hazardous = hasSetting ? setting!.HandlesHazardous : CollectorSettingService.DefaultSetting.HandlesHazardous;

            // Vehicle rules. A collector who cannot carry it is not an option at
            // all -- this is the part that must never be left to judgement.
            if (category == WasteCategory.Bulk && !bulky) continue;
            if (category == WasteCategory.Hazardous && !hazardous) continue;

            for (var offset = 1; offset <= HorizonDays; offset++)
            {
                var day = today.AddDays(offset);

                // An empty CollectionDays list means the zone has no fixed round,
                // so any day is allowed rather than none.
                var isCollectionDay = zone.CollectionDays.Count == 0
                    || zone.CollectionDays.Contains((int)day.DayOfWeek);
                if (!isCollectionDay && zone.CollectionDays.Count > 0) continue;

                load.TryGetValue((collector.Id, day), out var used);
                var remaining = capacity - used;
                if (remaining <= 0) continue;

                options.Add(new RoutingOptionDto
                {
                    CollectorId = collector.Id.ToString(),
                    CollectorName = string.IsNullOrWhiteSpace(collector.FullName) ? collector.Email : collector.FullName!,
                    Date = day.ToString("yyyy-MM-dd"),
                    RemainingCapacity = remaining,
                    IsCollectionDay = zone.CollectionDays.Count > 0,
                    DaysAway = offset
                });
            }
        }

        return new RoutingContextDto
        {
            Category = category.ToString(),
            ZoneName = zone.Name,
            PreferredDate = preferredDate?.ToUniversalTime().ToString("yyyy-MM-dd"),
            IsRestricted = category is WasteCategory.Hazardous or WasteCategory.Bulk,
            // Soonest first, then the emptiest day, so a truncated list still
            // holds the options most likely to be chosen.
            Options = options
                .OrderBy(o => o.DaysAway)
                .ThenByDescending(o => o.RemainingCapacity)
                .Take(20)
                .ToList()
        };
    }

    private static RoutingContextDto Empty(Zone zone, WasteCategory category) => new()
    {
        Category = category.ToString(),
        ZoneName = zone.Name,
        IsRestricted = category is WasteCategory.Hazardous or WasteCategory.Bulk,
        Options = []
    };
}
