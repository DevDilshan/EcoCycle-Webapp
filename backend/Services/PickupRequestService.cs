using backend.Data;
using backend.DTOs;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class PickupRequestService : IPickupRequestService
{
    private readonly ApplicationDbContext _db;

    public PickupRequestService(ApplicationDbContext db) => _db = db;

    public async Task<PickupRequestResponseDto> CreateAsync(Guid residentId, CreatePickupRequestDto dto)
    {
        var entity = new PickupRequest
        {
            ResidentId = residentId,
            PhotoUrl = dto.PhotoUrl,
            Description = dto.Description,
            PreferredDate = dto.PreferredDate,
            IsRecurring = dto.IsRecurring,
            RecurrenceInterval = dto.RecurrenceInterval,
            Status = PickupStatus.Pending
        };

        _db.PickupRequests.Add(entity);
        await _db.SaveChangesAsync();
        return ToDto(entity);
    }

    public async Task<PagedResult<PickupRequestResponseDto>> GetListAsync(
        Guid residentId, bool isAdmin, PickupRequestQueryParams query)
    {
        var q = _db.PickupRequests.AsNoTracking().AsQueryable();

        // Visibility: residents only ever see their own
        if (!isAdmin)
            q = q.Where(p => p.ResidentId == residentId);

        // Filtering
        if (query.Status.HasValue)
            q = q.Where(p => p.Status == query.Status.Value);
        if (query.FromDate.HasValue)
            q = q.Where(p => p.PreferredDate >= query.FromDate.Value);
        if (query.ToDate.HasValue)
            q = q.Where(p => p.PreferredDate <= query.ToDate.Value);

        // Sorting
        bool desc = string.Equals(query.SortDir, "desc", StringComparison.OrdinalIgnoreCase);
        q = query.SortBy?.ToLowerInvariant() switch
        {
            "preferreddate" => desc ? q.OrderByDescending(p => p.PreferredDate) : q.OrderBy(p => p.PreferredDate),
            "status"        => desc ? q.OrderByDescending(p => p.Status)        : q.OrderBy(p => p.Status),
            _               => desc ? q.OrderByDescending(p => p.CreatedAt)     : q.OrderBy(p => p.CreatedAt),
        };

        var total = await q.CountAsync();

        var items = await q
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(p => ToDto(p))
            .ToListAsync();

        return new PagedResult<PickupRequestResponseDto>
        {
            Items = items,
            Page = query.Page,
            PageSize = query.PageSize,
            TotalCount = total
        };
    }

    public async Task<PickupRequestResponseDto?> GetByIdAsync(Guid id, Guid residentId, bool isAdmin)
    {
        var entity = await _db.PickupRequests.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
        if (entity is null) return null;
        if (!isAdmin && entity.ResidentId != residentId) return null; // hide existence from other residents
        return ToDto(entity);
    }

    public async Task<PickupStatusDto?> GetStatusAsync(Guid id, Guid residentId, bool isAdmin)
    {
        var entity = await _db.PickupRequests.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
        if (entity is null) return null;
        if (!isAdmin && entity.ResidentId != residentId) return null;
        return new PickupStatusDto { Id = entity.Id, Status = entity.Status.ToString() };
    }

    public async Task<PickupRequestResponseDto?> UpdateAsync(
        Guid id, Guid residentId, bool isAdmin, UpdatePickupRequestDto dto)
    {
        var entity = await _db.PickupRequests.FirstOrDefaultAsync(p => p.Id == id);
        if (entity is null) return null;
        if (!isAdmin && entity.ResidentId != residentId)
            throw new UnauthorizedAccessException();
        if (entity.Status != PickupStatus.Pending)
            throw new InvalidOperationException("Only pending requests can be edited.");

        entity.PhotoUrl = dto.PhotoUrl;
        entity.Description = dto.Description;
        entity.PreferredDate = dto.PreferredDate;
        entity.IsRecurring = dto.IsRecurring;
        entity.RecurrenceInterval = dto.RecurrenceInterval;

        await _db.SaveChangesAsync();
        return ToDto(entity);
    }

    public async Task<PickupOperationResult> DeleteAsync(Guid id, Guid residentId, bool isAdmin)
    {
        var entity = await _db.PickupRequests.FirstOrDefaultAsync(p => p.Id == id);
        if (entity is null) return PickupOperationResult.NotFound;
        if (!isAdmin && entity.ResidentId != residentId) return PickupOperationResult.Forbidden;
        if (entity.Status != PickupStatus.Pending) return PickupOperationResult.NotEditable;

        _db.PickupRequests.Remove(entity);
        await _db.SaveChangesAsync();
        return PickupOperationResult.Success;
    }

    private static PickupRequestResponseDto ToDto(PickupRequest p) => new()
    {
        Id = p.Id,
        ResidentId = p.ResidentId,
        PhotoUrl = p.PhotoUrl,
        Description = p.Description,
        PreferredDate = p.PreferredDate,
        Status = p.Status.ToString(),
        IsRecurring = p.IsRecurring,
        RecurrenceInterval = p.RecurrenceInterval,
        CreatedAt = p.CreatedAt
    };
}