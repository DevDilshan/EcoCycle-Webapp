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

    public RouteAssignmentService(ApplicationDbContext context)
    {
        _context = context;
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
        await _context.SaveChangesAsync();

        return MapToDto(route);
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
        var pickupExists = await _context.PickupRequests
            .AnyAsync(p => p.Id == pickupRequestId);
        if (!pickupExists)
        {
            return null;
        }

        var zone = await _context.Zones
            .FirstOrDefaultAsync(z => z.IsActive && z.AssignedCollectorId != null);
        if (zone is null)
        {
            throw new InvalidOperationException("No active zone with an assigned collector is available.");
        }

        var route = new RouteAssignment
        {
            PickupRequestId = pickupRequestId,
            ZoneId = zone.Id,
            CollectorId = zone.AssignedCollectorId!.Value,
            ScheduledDate = DateTime.UtcNow.Date.AddDays(1),
            CompletionStatus = RouteCompletionStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        _context.RouteAssignments.Add(route);
        await _context.SaveChangesAsync();

        return MapToDto(route);
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
