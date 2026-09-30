using backend.Data;
using backend.DTOs;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class RedemptionService : IRedemptionService
{
    private readonly ApplicationDbContext _db;

    public RedemptionService(ApplicationDbContext db) => _db = db;

    public async Task<RedemptionResponseDto> CreateAsync(Guid residentId, CreateRedemptionDto dto)
    {
        if (!await _db.Profiles.AnyAsync(p => p.Id == residentId))
            throw new KeyNotFoundException("Resident not found.");

        var item = await GetRequestableItemAsync(dto.RewardItemId);
        await EnsureAvailableAsync(residentId, item.PointsCost, excludingRequestId: null);

        var entity = new RedemptionRequest
        {
            ResidentId = residentId,
            RewardItemId = item.Id,
            Points = item.PointsCost,
            Reason = item.Name
        };
        _db.RedemptionRequests.Add(entity);
        await _db.SaveChangesAsync();

        await _db.Entry(entity).Reference(r => r.Resident).LoadAsync();
        return ToDto(entity);
    }

    public async Task<PagedResult<RedemptionResponseDto>> GetListAsync(
        Guid currentUserId, bool isAdmin, RedemptionQueryParams query)
    {
        var q = _db.RedemptionRequests.AsNoTracking().AsQueryable();

        if (!isAdmin)
            q = q.Where(r => r.ResidentId == currentUserId);

        if (query.Status.HasValue)
            q = q.Where(r => r.Status == query.Status.Value);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            q = q.Where(r => r.Reason.ToLower().Contains(term)
                || (r.Resident != null
                    && ((r.Resident.FullName != null && r.Resident.FullName.ToLower().Contains(term))
                        || r.Resident.Email.ToLower().Contains(term))));
        }

        var desc = !string.Equals(query.SortDir, "asc", StringComparison.OrdinalIgnoreCase);
        q = query.SortBy?.ToLowerInvariant() switch
        {
            "points" => desc ? q.OrderByDescending(r => r.Points) : q.OrderBy(r => r.Points),
            "status" => desc ? q.OrderByDescending(r => r.Status) : q.OrderBy(r => r.Status),
            _ => desc ? q.OrderByDescending(r => r.CreatedAt) : q.OrderBy(r => r.CreatedAt),
        };

        var total = await q.CountAsync();
        var rows = await q
            .Include(r => r.Resident)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return new PagedResult<RedemptionResponseDto>
        {
            Items = rows.Select(ToDto).ToList(),
            Page = query.Page,
            PageSize = query.PageSize,
            TotalCount = total
        };
    }

    public async Task<RedemptionResponseDto?> GetByIdAsync(Guid id, Guid currentUserId, bool isAdmin)
    {
        var entity = await _db.RedemptionRequests
            .AsNoTracking()
            .Include(r => r.Resident)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (entity is null || (!isAdmin && entity.ResidentId != currentUserId))
            return null;

        return ToDto(entity);
    }

    public async Task<RedemptionResponseDto?> UpdateAsync(Guid id, Guid residentId, UpdateRedemptionDto dto)
    {
        var entity = await _db.RedemptionRequests
            .Include(r => r.Resident)
            .FirstOrDefaultAsync(r => r.Id == id && r.ResidentId == residentId);
        if (entity is null)
            return null;

        EnsurePending(entity, "edited");

        var item = await GetRequestableItemAsync(dto.RewardItemId);
        await EnsureAvailableAsync(residentId, item.PointsCost, excludingRequestId: id);

        entity.RewardItemId = item.Id;
        entity.Points = item.PointsCost;
        entity.Reason = item.Name;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return ToDto(entity);
    }

    public async Task<bool> DeleteAsync(Guid id, Guid residentId)
    {
        var entity = await _db.RedemptionRequests
            .FirstOrDefaultAsync(r => r.Id == id && r.ResidentId == residentId);
        if (entity is null)
            return false;

        EnsurePending(entity, "cancelled");
        _db.RedemptionRequests.Remove(entity);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<RedemptionResponseDto?> ApproveAsync(Guid id, Guid adminId, ReviewRedemptionDto dto)
    {
        var entity = await _db.RedemptionRequests
            .Include(r => r.Resident)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (entity is null)
            return null;

        EnsurePending(entity, "approved");

        // The balance may have dropped since the request was made.
        var balance = await BalanceAsync(entity.ResidentId);
        if (balance < entity.Points)
            throw new InvalidOperationException(
                $"The resident now has only {balance} points, less than the {entity.Points} requested.");

        // Take one from the shelf, if the item is counted. The item may have
        // been deleted since (then only the stored copy of the request remains).
        if (entity.RewardItemId is { } itemId)
        {
            var item = await _db.RewardItems.FirstOrDefaultAsync(i => i.Id == itemId);
            if (item?.Stock is { } stock)
            {
                if (stock <= 0)
                    throw new InvalidOperationException($"\"{item.Name}\" is out of stock.");
                item.Stock = stock - 1;
                item.UpdatedAt = DateTime.UtcNow;
            }
        }

        var now = DateTime.UtcNow;
        entity.Status = RedemptionStatus.Approved;
        entity.AdminNote = string.IsNullOrWhiteSpace(dto.AdminNote) ? null : dto.AdminNote.Trim();
        entity.ReviewedByAdminId = adminId;
        entity.ReviewedAt = now;
        entity.UpdatedAt = now;

        // Status change and ledger row go out in a single save, so they commit together.
        _db.RewardPoints.Add(new RewardPoint
        {
            ResidentId = entity.ResidentId,
            PickupRequestId = null,
            PointsEarned = -entity.Points,
            Reason = $"Redemption: {entity.Reason}",
            CreatedAt = now
        });
        await _db.SaveChangesAsync();

        return ToDto(entity);
    }

    public async Task<RedemptionResponseDto?> RejectAsync(Guid id, Guid adminId, ReviewRedemptionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.AdminNote))
            throw new ArgumentException("A note explaining the rejection is required.");

        var entity = await _db.RedemptionRequests
            .Include(r => r.Resident)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (entity is null)
            return null;

        EnsurePending(entity, "rejected");

        var now = DateTime.UtcNow;
        entity.Status = RedemptionStatus.Rejected;
        entity.AdminNote = dto.AdminNote.Trim();
        entity.ReviewedByAdminId = adminId;
        entity.ReviewedAt = now;
        entity.UpdatedAt = now;
        await _db.SaveChangesAsync();

        return ToDto(entity);
    }

    private async Task<int> BalanceAsync(Guid residentId) =>
        await _db.RewardPoints
            .Where(r => r.ResidentId == residentId)
            .SumAsync(r => (int?)r.PointsEarned) ?? 0;

    // Points already promised to other pending requests cannot be spent twice.
    private async Task EnsureAvailableAsync(Guid residentId, int points, Guid? excludingRequestId)
    {
        var balance = await BalanceAsync(residentId);
        var pending = await _db.RedemptionRequests
            .Where(r => r.ResidentId == residentId
                        && r.Status == RedemptionStatus.Pending
                        && r.Id != excludingRequestId)
            .SumAsync(r => (int?)r.Points) ?? 0;

        var available = balance - pending;
        if (points > available)
            throw new InvalidOperationException(
                $"Insufficient reward points: {available} available ({balance} balance, {pending} already requested).");
    }

    private static void EnsurePending(RedemptionRequest entity, string action)
    {
        if (entity.Status != RedemptionStatus.Pending)
            throw new InvalidOperationException(
                $"Only a pending request can be {action}; this one is {entity.Status}.");
    }

    private async Task<RewardItem> GetRequestableItemAsync(Guid itemId)
    {
        var item = await _db.RewardItems.AsNoTracking().FirstOrDefaultAsync(i => i.Id == itemId)
                   ?? throw new KeyNotFoundException("Reward item not found.");
        if (!item.IsActive)
            throw new InvalidOperationException($"\"{item.Name}\" is not available right now.");
        if (item.Stock is <= 0)
            throw new InvalidOperationException($"\"{item.Name}\" is out of stock.");
        return item;
    }

    private static RedemptionResponseDto ToDto(RedemptionRequest r) => new()
    {
        Id = r.Id,
        ResidentId = r.ResidentId,
        ResidentName = r.Resident?.FullName ?? r.Resident?.Email ?? "Unknown resident",
        RewardItemId = r.RewardItemId,
        Points = r.Points,
        Reason = r.Reason,
        Status = r.Status,
        AdminNote = r.AdminNote,
        ReviewedAt = r.ReviewedAt,
        CreatedAt = r.CreatedAt,
        UpdatedAt = r.UpdatedAt
    };
}
