using Microsoft.EntityFrameworkCore;
using backend.Data;
using backend.DTOs;
using backend.Models;

namespace backend.Services;

public class RouteAssignmentService
{
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

    public async Task<List<CollectorLoadDto>> GetLoadReportAsync()
    {
        return await _context.RouteAssignments
            .AsNoTracking()
            .GroupBy(r => r.CollectorId)
            .Select(g => new CollectorLoadDto
            {
                CollectorId = g.Key,
                TotalAssignments = g.Count(),
                PendingAssignments = g.Count(r => r.CompletionStatus == RouteCompletionStatus.Pending),
                CompletedAssignments = g.Count(r => r.CompletionStatus == RouteCompletionStatus.Completed),
                MissedAssignments = g.Count(r => r.CompletionStatus == RouteCompletionStatus.Missed)
            })
            .ToListAsync();
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
