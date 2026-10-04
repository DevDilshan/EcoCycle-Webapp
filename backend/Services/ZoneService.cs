using Microsoft.EntityFrameworkCore;
using backend.Data;
using backend.DTOs;
using backend.Models;

namespace backend.Services;

/// <summary>The outcome of retiring a zone.</summary>
/// <param name="Outcome">What happened.</param>
/// <param name="OpenRequests">
/// How many uncollected pickups are still sitting in the zone. Only meaningful
/// with <see cref="ZoneRetirementOutcome.NeedsDestination"/>.
/// </param>
/// <param name="Moved">How many pickups were moved to the replacement zone.</param>
/// <param name="Unscheduled">
/// Of those moved, how many could not be booked onto a round in the new zone and
/// need placing by hand.
/// </param>
public record ZoneRetirementResult(
    ZoneRetirementOutcome Outcome,
    int OpenRequests = 0,
    int Moved = 0,
    int Unscheduled = 0);

public enum ZoneRetirementOutcome
{
    NotFound,

    /// <summary>
    /// The zone still has uncollected pickups, and no replacement zone was
    /// named. Retiring it anyway would leave them unroutable with nobody told.
    /// </summary>
    NeedsDestination,

    /// <summary>The named replacement is missing, inactive, or the zone itself.</summary>
    BadDestination,

    Retired,
}

public class ZoneService
{
    private readonly ApplicationDbContext _context;
    private readonly PickupSchedulingService _scheduling;
    private readonly ILogger<ZoneService> _logger;

    public ZoneService(
        ApplicationDbContext context,
        PickupSchedulingService scheduling,
        ILogger<ZoneService> logger)
    {
        _context = context;
        _scheduling = scheduling;
        _logger = logger;
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
    /// <summary>
    /// Active zones as id + name, for a chooser.
    /// </summary>
    /// <remarks>
    /// Unlike GetPublicZonesAsync this does NOT require coordinates: a zone with
    /// no lat/lng cannot be drawn on the map but is still routable, so a
    /// resident has to be able to pick it when booking a pickup.
    /// </remarks>
    public async Task<List<ZoneOptionDto>> GetSelectableZonesAsync()
    {
        return await _context.Zones
            .AsNoTracking()
            .Where(z => z.IsActive)
            .OrderBy(z => z.Name)
            .Select(z => new ZoneOptionDto { Id = z.Id, Name = z.Name, CollectionDays = z.CollectionDays })
            .ToListAsync();
    }

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
        await EnsureAssignableAsync(dto.AssignedCollectorId);
        await EnsureNameIsFreeAsync(dto.Name, excludingId: null);

        var zone = new Zone
        {
            Name = dto.Name.Trim(),
            Description = dto.Description,
            AssignedCollectorId = dto.AssignedCollectorId,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            CollectionDays = NormaliseCollectionDays(dto.CollectionDays),
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

        await EnsureAssignableAsync(dto.AssignedCollectorId);
        await EnsureNameIsFreeAsync(dto.Name, excludingId: id);

        zone.Name = dto.Name.Trim();
        zone.Description = dto.Description;
        zone.AssignedCollectorId = dto.AssignedCollectorId;
        zone.Latitude = dto.Latitude;
        zone.Longitude = dto.Longitude;
        zone.CollectionDays = NormaliseCollectionDays(dto.CollectionDays);
        zone.IsActive = dto.IsActive;
        zone.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return MapToDto(zone);
    }

    /// <summary>
    /// Retires a zone by deactivating it. Despite the name and the DELETE verb,
    /// the row is kept.
    /// </summary>
    /// <remarks>
    /// Removing the row is not survivable: RouteAssignment.ZoneId is Restrict
    /// and PickupRequest.ZoneId has no cascade, so any zone that has ever been
    /// used would fail at the database with an unhandled 500. Worse, a zone that
    /// deleted cleanly would take its history with it, and every completed
    /// pickup in it would lose the zone it was collected from.
    ///
    /// Deactivating does everything an admin wants from "delete": the zone stops
    /// being offered for routing (AssignPickupToRouteAsync only accepts active
    /// zones) and drops off the map, while the records that point at it stay
    /// readable.
    /// </remarks>
    /// <param name="moveOpenRequestsToZoneId">
    /// Where to send pickups that have not been collected yet. Required when
    /// there are any: an uncollected pickup in a retired zone can never be
    /// routed, because routing only ever offers active zones, so it would sit
    /// there forever with nobody told. Residents themselves are not attached to
    /// a zone -- they choose one per request -- so their open requests are the
    /// only thing that needs moving.
    /// </param>
    public async Task<ZoneRetirementResult> DeleteZoneAsync(
        Guid id,
        Guid? moveOpenRequestsToZoneId = null)
    {
        var zone = await _context.Zones.FirstOrDefaultAsync(z => z.Id == id);
        if (zone is null)
        {
            return new ZoneRetirementResult(ZoneRetirementOutcome.NotFound);
        }

        // Already retired: report success so a repeated click is harmless.
        if (!zone.IsActive)
        {
            return new ZoneRetirementResult(ZoneRetirementOutcome.Retired);
        }

        // Rejected and Completed requests are finished with; they keep pointing
        // at this zone on purpose, because that is where they happened.
        var openRequests = await _context.PickupRequests
            .Where(p => p.ZoneId == id
                && p.Status != PickupStatus.Completed
                && p.Status != PickupStatus.Rejected)
            .ToListAsync();

        if (openRequests.Count > 0 && moveOpenRequestsToZoneId is null)
        {
            return new ZoneRetirementResult(
                ZoneRetirementOutcome.NeedsDestination,
                OpenRequests: openRequests.Count);
        }

        var unscheduled = 0;

        if (openRequests.Count > 0)
        {
            var destinationId = moveOpenRequestsToZoneId!.Value;

            // Moving them into the zone being retired, or into another retired
            // one, would leave them exactly as stranded as doing nothing.
            var destinationIsUsable = destinationId != id
                && await _context.Zones.AnyAsync(z => z.Id == destinationId && z.IsActive);
            if (!destinationIsUsable)
            {
                return new ZoneRetirementResult(ZoneRetirementOutcome.BadDestination);
            }

            var pickupIds = openRequests.Select(p => p.Id).ToList();

            // The booked stops belong to the old zone's round: a different
            // collector, on days this zone was collected and the new one may not
            // be. Keeping them would send someone to a round they are no longer
            // on, so they are dropped and the pickups booked again below.
            var stops = await _context.RouteAssignments
                .Where(r => pickupIds.Contains(r.PickupRequestId)
                    && r.CompletionStatus == RouteCompletionStatus.Pending)
                .ToListAsync();
            _context.RouteAssignments.RemoveRange(stops);

            foreach (var pickup in openRequests)
            {
                pickup.ZoneId = destinationId;
            }

            zone.IsActive = false;
            zone.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // Rebooking is deliberately after the save. Each one calls the
            // routing agent and may legitimately fail -- every round in the new
            // zone could be full -- and a zone left half-retired because the
            // eighth pickup could not be placed would be worse than one that is
            // retired with a few stops for an admin to place by hand.
            foreach (var pickup in openRequests)
            {
                if (pickup.Status is PickupStatus.Pending or PickupStatus.Classified)
                {
                    // Never routed yet; it is waiting on approval, not on us.
                    continue;
                }

                var failure = await _scheduling.ScheduleAsync(pickup.Id);
                if (failure is not null)
                {
                    unscheduled++;
                    _logger.LogWarning(
                        "Pickup {PickupId} moved out of retired zone {ZoneId} but could not be "
                        + "rebooked: {Reason}", pickup.Id, id, failure);
                }
            }

            return new ZoneRetirementResult(
                ZoneRetirementOutcome.Retired,
                OpenRequests: openRequests.Count,
                Moved: openRequests.Count,
                Unscheduled: unscheduled);
        }

        zone.IsActive = false;
        zone.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return new ZoneRetirementResult(ZoneRetirementOutcome.Retired);
    }

    /// <summary>
    /// Keeps only real weekday numbers, de-duplicated and in week order.
    /// </summary>
    /// <remarks>
    /// The value comes straight from an admin form, so 8s and repeats are
    /// possible; the routing agent is given this list verbatim and would have no
    /// way to tell a typo from a real day.
    /// </remarks>
    /// <summary>
    /// Refuses a collector id that is not a collector's.
    /// </summary>
    /// <remarks>
    /// Checked on the role, not merely on existence. Every id here is a profiles
    /// row, so a resident's id is a valid foreign key and the database cannot tell
    /// the two apart -- a zone assigned to a resident routes its pickups to
    /// somebody with no collector screen, and the stops are never driven.
    /// </remarks>
    private async Task EnsureAssignableAsync(Guid? collectorId)
    {
        // Unassigned is allowed: a zone can exist before anyone is put on it.
        if (collectorId is null || collectorId == Guid.Empty) return;

        var role = await _context.Profiles
            .AsNoTracking()
            .Where(p => p.Id == collectorId)
            .Select(p => p.Role)
            .FirstOrDefaultAsync();

        if (role is null)
            throw new ArgumentException("That collector no longer exists.");

        if (!string.Equals(role, "collector", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("A zone can only be assigned to a collector.");
    }

    /// <summary>
    /// Refuses a name another zone already has.
    /// </summary>
    /// <remarks>
    /// Case-insensitively, because "Dehiwala" and "dehiwala" are the same suburb
    /// and a resident choosing between two identical-looking entries in a dropdown
    /// has no way to pick the right one. Retired zones are counted too: their name
    /// is still on the rounds and complaints they are attached to.
    /// </remarks>
    private async Task EnsureNameIsFreeAsync(string name, Guid? excludingId)
    {
        var trimmed = name.Trim();
        var clash = await _context.Zones
            .AsNoTracking()
            .AnyAsync(z => z.Id != excludingId
                && z.Name.ToLower() == trimmed.ToLower());

        if (clash)
            throw new ArgumentException($"A zone called {trimmed} already exists.");
    }

    private static List<int> NormaliseCollectionDays(IEnumerable<int>? days)
        => (days ?? [])
            .Where(d => d is >= 0 and <= 6)
            .Distinct()
            .OrderBy(d => d)
            .ToList();

    private static ZoneDto MapToDto(Zone zone) => new()
    {
        Id = zone.Id,
        Name = zone.Name,
        Description = zone.Description,
        AssignedCollectorId = zone.AssignedCollectorId,
        Latitude = zone.Latitude,
        Longitude = zone.Longitude,
        CollectionDays = zone.CollectionDays,
        IsActive = zone.IsActive,
        UpdatedAt = zone.UpdatedAt,
        CreatedAt = zone.CreatedAt
    };
}
