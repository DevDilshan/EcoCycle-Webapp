using Microsoft.EntityFrameworkCore;
using backend.Data;
using backend.DTOs;
using backend.Models;

namespace backend.Services;

public class RouteAssignmentService
{
    // Matches the role string used by ProfilesController and the "collector" JWT role.
    private const string CollectorRole = "collector";

    private readonly ApplicationDbContext _context;
    private readonly IRewardService _rewards;

    public RouteAssignmentService(ApplicationDbContext context, IRewardService rewards)
    {
        _context = context;
        _rewards = rewards;
    }

    public async Task<List<RouteAssignmentDto>> GetTodayRouteForCollectorAsync(Guid collectorId)
    {
        var today = DateTime.UtcNow.Date;
        var tomorrow = today.AddDays(1);

        return await _context.RouteAssignments
            .AsNoTracking()
            .Where(r => r.CollectorId == collectorId
                && r.ScheduledDate >= today
                && r.ScheduledDate < tomorrow)
            .OrderBy(r => r.ScheduledDate)
            .Select(r => MapToDto(r))
            .ToListAsync();
    }

    /// <summary>
    /// A collector's stops scheduled after today, so they can see what is coming
    /// rather than only the current day.
    /// </summary>
    /// <param name="days">
    /// How far ahead to look, counted from tomorrow. Clamped to 1..30: a
    /// collector plans days ahead, not months, and an unbounded range would let
    /// one request walk the whole table.
    /// </param>
    public async Task<List<RouteAssignmentDto>> GetUpcomingRouteForCollectorAsync(Guid collectorId, int days = 7)
    {
        var from = DateTime.UtcNow.Date.AddDays(1);
        var to = from.AddDays(Math.Clamp(days, 1, 30));

        return await _context.RouteAssignments
            .AsNoTracking()
            .Where(r => r.CollectorId == collectorId
                && r.ScheduledDate >= from
                && r.ScheduledDate < to)
            .OrderBy(r => r.ScheduledDate)
            .Select(r => MapToDto(r))
            .ToListAsync();
    }

    public async Task<RouteAssignmentDto> CreateAsync(CreateRouteAssignmentDto dto)
    {
        var route = new RouteAssignment
        {
            PickupRequestId = dto.PickupRequestId,
            CollectorId = dto.CollectorId,
            ZoneId = dto.ZoneId,
            ScheduledDate = dto.ScheduledDate,
            CompletionStatus = RouteCompletionStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        _context.RouteAssignments.Add(route);
        await MarkPickupScheduledAsync(dto.PickupRequestId);
        await _context.SaveChangesAsync();

        return MapToDto(route);
    }

    /// <summary>
    /// Moves a pickup to Scheduled once it has a collector.
    /// </summary>
    /// <remarks>
    /// Both agent paths already do this when they add an assignment
    /// (ApprovalService and PickupRequestService); the two manual paths did not,
    /// so a pickup routed by hand kept its old status and stayed under the wrong
    /// filter on the requests list for ever.
    ///
    /// Completed is left alone: a pickup that has already been collected must
    /// not be walked backwards by a late assignment.
    /// </remarks>
    private async Task MarkPickupScheduledAsync(Guid pickupRequestId)
    {
        var pickup = await _context.PickupRequests
            .FirstOrDefaultAsync(p => p.Id == pickupRequestId);

        if (pickup is null || pickup.Status == PickupStatus.Completed)
        {
            return;
        }

        pickup.Status = PickupStatus.Scheduled;
    }

    public async Task<RouteAssignmentDto?> MarkCompleteAsync(Guid id, string? issueNotes = null)
    {
        var route = await _context.RouteAssignments.FirstOrDefaultAsync(r => r.Id == id);
        if (route is null)
        {
            return null;
        }

        route.CompletionStatus = RouteCompletionStatus.Completed;
        route.CompletedAt = DateTime.UtcNow;
        route.IssueNotes = issueNotes;
        route.UpdatedAt = DateTime.UtcNow;

        // Collected: close the pickup and pay the resident in the same save,
        // so a completed pickup can never be left without its points.
        var pickup = await _context.PickupRequests.FirstOrDefaultAsync(p => p.Id == route.PickupRequestId);
        if (pickup is not null)
        {
            pickup.Status = PickupStatus.Completed;
            await _rewards.StageCompletionAwardAsync(pickup.Id);
        }

        await _context.SaveChangesAsync();

        return MapToDto(route);
    }

    /// <summary>
    /// Every stop scheduled on one day, across all collectors, for the admin.
    /// </summary>
    /// <remarks>
    /// The per-collector endpoints answer "what am I doing today"; this answers
    /// "what is happening today", which is what an admin needs in order to spot
    /// a stop nobody closed off.
    /// </remarks>
    /// <param name="date">The day to report on, in UTC. Defaults to today.</param>
    public async Task<List<RouteAssignmentDto>> GetAssignmentsForDayAsync(DateTime? date = null)
    {
        // Kind matters here. ScheduledDate is "timestamp with time zone", and
        // Npgsql refuses a DateTime whose Kind is Unspecified -- which is
        // exactly what model binding produces from ?date=2026-10-02. Without
        // this the query throws the moment a date is supplied, and the caller
        // sees an empty table rather than an error.
        var from = DateTime.SpecifyKind((date ?? DateTime.UtcNow).Date, DateTimeKind.Utc);
        var to = from.AddDays(1);

        return await _context.RouteAssignments
            .AsNoTracking()
            .Where(r => r.ScheduledDate >= from && r.ScheduledDate < to)
            .OrderBy(r => r.ScheduledDate)
            .Select(r => MapToDto(r))
            .ToListAsync();
    }

    /// <summary>
    /// Records that a stop was not collected. Admin-only: a collector marks work
    /// done, an admin accounts for work that was not.
    /// </summary>
    /// <remarks>
    /// Nothing else in the system writes Missed, so without this the status
    /// existed on the enum and in every count but could never occur.
    ///
    /// Only a pending stop can be missed. Re-marking a completed one would
    /// silently erase its CompletedAt, so that is refused rather than accepted.
    /// </remarks>
    /// <returns>Null when no such stop exists; the updated stop once missed.</returns>
    public async Task<RouteAssignmentDto?> MarkMissedAsync(Guid id, string? issueNotes = null)
    {
        var route = await _context.RouteAssignments.FirstOrDefaultAsync(r => r.Id == id);
        if (route is null)
        {
            return null;
        }

        if (route.CompletionStatus == RouteCompletionStatus.Completed)
        {
            throw new InvalidOperationException(
                "This stop is already completed, so it cannot be marked missed.");
        }

        route.CompletionStatus = RouteCompletionStatus.Missed;
        route.CompletedAt = null;
        if (!string.IsNullOrWhiteSpace(issueNotes))
        {
            route.IssueNotes = issueNotes;
        }
        route.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return MapToDto(route);
    }

    public async Task<RouteAssignmentDto?> ReassignAsync(Guid id, Guid newCollectorId)
    {
        var route = await _context.RouteAssignments.FirstOrDefaultAsync(r => r.Id == id);
        if (route is null)
        {
            return null;
        }

        route.CollectorId = newCollectorId;
        route.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return MapToDto(route);
    }

    /// <summary>
    /// Load per collector, including collectors who have never been assigned anything.
    /// </summary>
    /// <remarks>
    /// Driven from the collector list rather than from RouteAssignments. Grouping
    /// the assignments alone silently omits any collector with no rows -- and an
    /// idle collector is exactly the one a load balancer most needs to see, so
    /// the omission biased every routing decision away from them.
    /// </remarks>
    public async Task<List<CollectorLoadDto>> GetLoadReportAsync()
    {
        return await _context.Profiles
            .AsNoTracking()
            .Where(p => p.Role == CollectorRole)
            .Select(p => new CollectorLoadDto
            {
                CollectorId = p.Id,
                TotalAssignments = _context.RouteAssignments
                    .Count(r => r.CollectorId == p.Id),
                PendingAssignments = _context.RouteAssignments
                    .Count(r => r.CollectorId == p.Id && r.CompletionStatus == RouteCompletionStatus.Pending),
                CompletedAssignments = _context.RouteAssignments
                    .Count(r => r.CollectorId == p.Id && r.CompletionStatus == RouteCompletionStatus.Completed),
                MissedAssignments = _context.RouteAssignments
                    .Count(r => r.CollectorId == p.Id && r.CompletionStatus == RouteCompletionStatus.Missed)
            })
            .ToListAsync();
    }

    /// <summary>
    /// Pickup counts per zone, for the admin zone cards.
    /// </summary>
    /// <remarks>
    /// Driven from the zone list so a zone with no assignments still appears,
    /// reporting zeroes rather than vanishing.
    /// </remarks>
    public async Task<List<ZoneLoadDto>> GetZoneLoadReportAsync()
    {
        var today = DateTime.UtcNow.Date;
        var tomorrow = today.AddDays(1);

        return await _context.Zones
            .AsNoTracking()
            .OrderBy(z => z.Name)
            .Select(z => new ZoneLoadDto
            {
                ZoneId = z.Id,
                ZoneName = z.Name,
                PendingAssignments = _context.RouteAssignments
                    .Count(r => r.ZoneId == z.Id && r.CompletionStatus == RouteCompletionStatus.Pending),
                DueToday = _context.RouteAssignments
                    .Count(r => r.ZoneId == z.Id
                                && r.CompletionStatus == RouteCompletionStatus.Pending
                                && r.ScheduledDate >= today && r.ScheduledDate < tomorrow),
                CompletedAssignments = _context.RouteAssignments
                    .Count(r => r.ZoneId == z.Id && r.CompletionStatus == RouteCompletionStatus.Completed),
                MissedAssignments = _context.RouteAssignments
                    .Count(r => r.ZoneId == z.Id && r.CompletionStatus == RouteCompletionStatus.Missed),
                TotalAssignments = _context.RouteAssignments.Count(r => r.ZoneId == z.Id),
            })
            .ToListAsync();
    }

    public async Task<RouteAssignmentDto?> AssignPickupToRouteAsync(Guid pickupRequestId)
    {
        var pickup = await _context.PickupRequests
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == pickupRequestId);
        if (pickup is null)
        {
            return null;
        }

        // Route to the zone the pickup is actually in. This used to take the
        // first active zone with a collector, which sent a Dehiwala pickup to
        // whichever collector the database happened to return first -- and with
        // no OrderBy, that could differ between two identical calls.
        if (pickup.ZoneId is null)
        {
            throw new InvalidOperationException(
                "This pickup has no zone, so a collector cannot be chosen. Assign a zone and retry.");
        }

        var zone = await _context.Zones
            .FirstOrDefaultAsync(z => z.Id == pickup.ZoneId.Value && z.IsActive);
        if (zone is null)
        {
            throw new InvalidOperationException(
                "The pickup's zone is inactive or no longer exists, so it cannot be scheduled.");
        }

        // The zone's own collector is the default. When the zone has none, fall
        // back to the least-loaded collector by pending work, which is the same
        // basis the agent router uses.
        var collectorId = zone.AssignedCollectorId ?? await LeastLoadedCollectorIdAsync();
        if (collectorId is null)
        {
            throw new InvalidOperationException(
                "No collector is assigned to this zone and no other collector is available.");
        }

        var route = new RouteAssignment
        {
            PickupRequestId = pickupRequestId,
            ZoneId = zone.Id,
            CollectorId = collectorId.Value,
            // Today, not tomorrow: an admin assigning a pickup expects it on the
            // collector's screen now, and GetTodayRouteForCollectorAsync only
            // returns the current UTC day.
            ScheduledDate = DateTime.UtcNow.Date,
            CompletionStatus = RouteCompletionStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        _context.RouteAssignments.Add(route);
        await MarkPickupScheduledAsync(pickupRequestId);
        await _context.SaveChangesAsync();

        return MapToDto(route);
    }

    /// <summary>
    /// The collector carrying the fewest pending stops, or null when there are
    /// no collectors at all. Ties break on the smallest id so the same input
    /// gives the same answer twice.
    /// </summary>
    private async Task<Guid?> LeastLoadedCollectorIdAsync()
    {
        var candidates = await _context.Profiles
            .AsNoTracking()
            .Where(p => p.Role == CollectorRole)
            .Select(p => new
            {
                p.Id,
                Pending = _context.RouteAssignments
                    .Count(r => r.CollectorId == p.Id && r.CompletionStatus == RouteCompletionStatus.Pending)
            })
            .ToListAsync();

        return candidates
            .OrderBy(c => c.Pending)
            .ThenBy(c => c.Id)
            .Select(c => (Guid?)c.Id)
            .FirstOrDefault();
    }

    private static RouteAssignmentDto MapToDto(RouteAssignment route) => new()
    {
        Id = route.Id,
        PickupRequestId = route.PickupRequestId,
        CollectorId = route.CollectorId,
        ZoneId = route.ZoneId,
        ScheduledDate = route.ScheduledDate,
        CompletionStatus = route.CompletionStatus,
        CompletedAt = route.CompletedAt,
        IssueNotes = route.IssueNotes,
        UpdatedAt = route.UpdatedAt,
        CreatedAt = route.CreatedAt
    };
}
