using backend.Data;
using backend.DTOs;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class ComplaintService : IComplaintService
{
    private readonly ApplicationDbContext _db;

    public ComplaintService(ApplicationDbContext db) => _db = db;

    public async Task<ComplaintResponseDto> CreateAsync(Guid residentId, CreateComplaintDto dto)
    {
        if (dto.PickupRequestId == Guid.Empty)
            throw new ArgumentException("Pickup request is required.");

        var description = dto.Description?.Trim() ?? string.Empty;
        if (description.Length < 10)
            throw new ArgumentException("Description must be at least 10 characters.");
        if (description.Length > 2000)
            throw new ArgumentException("Description must be 2000 characters or fewer.");

        var pickupExists = await _db.PickupRequests
            .AsNoTracking()
            .AnyAsync(p => p.Id == dto.PickupRequestId && p.ResidentId == residentId);

        if (!pickupExists)
            throw new KeyNotFoundException("Pickup request not found for this resident.");

        var hasOpenComplaint = await _db.Complaints.AnyAsync(c =>
            c.ResidentId == residentId
            && c.PickupRequestId == dto.PickupRequestId
            && c.Status != ComplaintStatus.Resolved);

        if (hasOpenComplaint)
            throw new InvalidOperationException(
                "You already have an open complaint for this pickup. Wait for a response or use the existing one.");

        var entity = new Complaint
        {
            ResidentId = residentId,
            PickupRequestId = dto.PickupRequestId,
            Description = description,
            PhotoUrl = NormalizePhotoUrl(dto.PhotoUrl),
            Status = ComplaintStatus.Open
        };

        _db.Complaints.Add(entity);
        await _db.SaveChangesAsync();
        return ToDto(entity);
    }

    public async Task<PagedResult<ComplaintResponseDto>> GetListAsync(
        Guid userId, bool isAdmin, ComplaintQueryParams query)
    {
        var q = _db.Complaints.AsNoTracking().AsQueryable();

        // A resident sees only their own complaints; an admin sees everyone's.
        if (!isAdmin)
            q = q.Where(c => c.ResidentId == userId);

        if (query.Status.HasValue)
            q = q.Where(c => c.Status == query.Status.Value);

        var desc = string.Equals(query.SortDir, "desc", StringComparison.OrdinalIgnoreCase);
        q = query.SortBy?.ToLowerInvariant() switch
        {
            "status" => desc ? q.OrderByDescending(c => c.Status) : q.OrderBy(c => c.Status),
            "resolvedat" => desc ? q.OrderByDescending(c => c.ResolvedAt) : q.OrderBy(c => c.ResolvedAt),
            _ => desc ? q.OrderByDescending(c => c.CreatedAt) : q.OrderBy(c => c.CreatedAt),
        };

        var total = await q.CountAsync();

        var items = await q
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(c => ToDto(c))
            .ToListAsync();

        return new PagedResult<ComplaintResponseDto>
        {
            Items = items,
            Page = query.Page,
            PageSize = query.PageSize,
            TotalCount = total
        };
    }

    public async Task<ComplaintResponseDto?> GetByIdAsync(Guid id, Guid userId, bool isAdmin)
    {
        var entity = await _db.Complaints.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id);
        if (entity is null) return null;
        if (!isAdmin && entity.ResidentId != userId) return null;
        return ToDto(entity);
    }

    public async Task<ComplaintResponseDto?> UpdateAsync(Guid id, UpdateComplaintDto dto)
    {
        var entity = await _db.Complaints.FirstOrDefaultAsync(c => c.Id == id);
        if (entity is null) return null;

        entity.Status = dto.Status;
        entity.AdminNotes = dto.AdminNotes?.Trim();

        entity.ResolvedAt = dto.Status == ComplaintStatus.Resolved
            ? DateTime.UtcNow
            : dto.Status == ComplaintStatus.Open ? null : entity.ResolvedAt;

        await _db.SaveChangesAsync();
        return ToDto(entity);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var entity = await _db.Complaints.FirstOrDefaultAsync(c => c.Id == id);
        if (entity is null) return false;

        _db.Complaints.Remove(entity);
        await _db.SaveChangesAsync();
        return true;
    }

    // The link is shown to admins, so only a plain https address is kept.
    private static string? NormalizePhotoUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;
        var trimmed = url.Trim();
        if (trimmed.Length > 2048
            || !Uri.TryCreate(trimmed, UriKind.Absolute, out var uri)
            || uri.Scheme != Uri.UriSchemeHttps
            || !string.IsNullOrEmpty(uri.UserInfo))
            throw new ArgumentException("The attached photo link is not valid. Attach the photo again.");
        return trimmed;
    }

    private static ComplaintResponseDto ToDto(Complaint c) => new()
    {
        Id = c.Id,
        ResidentId = c.ResidentId,
        PickupRequestId = c.PickupRequestId,
        Description = c.Description,
        Status = c.Status.ToString(),
        AdminNotes = c.AdminNotes,
        PhotoUrl = c.PhotoUrl,
        ResolvedAt = c.ResolvedAt,
        CreatedAt = c.CreatedAt
    };
}
