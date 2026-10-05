using backend.Data;
using backend.DTOs;
using backend.Models;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class RedemptionService : IRedemptionService
{
    // Used when the item has no instructions of its own.
    public static string DefaultDeliveryInstructions(RewardDelivery delivery) => delivery switch
    {
        RewardDelivery.Email => "We will email this reward to your account email address within 3 working days.",
        RewardDelivery.Post => "We will post this reward to the address you gave within 7 working days.",
        _ => "Show this code at your municipal council office to collect your reward."
    };

    // No 0/O or 1/I/L: the code is read aloud and typed at a counter.
    private const string CodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

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
            Reason = item.Name,
            Delivery = item.Delivery,
            DeliveryAddress = AddressFor(item, dto.DeliveryAddress)
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
                || (r.CollectionCode != null && r.CollectionCode.ToLower().Contains(term))
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
        entity.Delivery = item.Delivery;
        entity.DeliveryAddress = AddressFor(item, dto.DeliveryAddress ?? entity.DeliveryAddress);
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
            entity.DeliveryInstructions = string.IsNullOrWhiteSpace(item?.DeliveryInstructions)
                ? null
                : item.DeliveryInstructions.Trim();
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
        entity.CollectionCode = await NewCollectionCodeAsync();

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

    public async Task<RedemptionResponseDto?> FulfilAsync(Guid id)
    {
        var entity = await _db.RedemptionRequests
            .Include(r => r.Resident)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (entity is null)
            return null;

        if (entity.Status != RedemptionStatus.Approved)
            throw new InvalidOperationException(
                $"Only an approved request can be handed over; this one is {entity.Status}.");
        if (entity.FulfilledAt is not null)
            throw new InvalidOperationException("This reward has already been handed over.");

        var now = DateTime.UtcNow;
        entity.FulfilledAt = now;
        entity.UpdatedAt = now;
        await _db.SaveChangesAsync();

        return ToDto(entity);
    }

    // ECO-XXXX-XXXX from 31 symbols is about 850 billion codes, so a clash is
    // rare; checking here is still cheaper than a failed save on the unique index.
    private async Task<string> NewCollectionCodeAsync()
    {
        while (true)
        {
            var chars = RandomNumberGenerator.GetItems<char>(CodeAlphabet, 8);
            var code = $"ECO-{new string(chars, 0, 4)}-{new string(chars, 4, 4)}";
            if (!await _db.RedemptionRequests.AnyAsync(r => r.CollectionCode == code))
                return code;
        }
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

    // A posted item needs somewhere to go; nothing else keeps an address.
    private static string? AddressFor(RewardItem item, string? address)
    {
        if (item.Delivery != RewardDelivery.Post)
            return null;
        if (string.IsNullOrWhiteSpace(address) || address.Trim().Length < 10)
            throw new ArgumentException(
                $"\"{item.Name}\" is sent by post. Enter the full address to post it to.");
        return address.Trim();
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
        ResidentEmail = r.Resident?.Email ?? string.Empty,
        RewardItemId = r.RewardItemId,
        Points = r.Points,
        Reason = r.Reason,
        Status = r.Status,
        AdminNote = r.AdminNote,
        ReviewedAt = r.ReviewedAt,
        Delivery = r.Delivery,
        DeliveryAddress = r.DeliveryAddress,
        CollectionCode = r.CollectionCode,
        // Requests approved before codes existed have neither; keep them blank.
        DeliveryInstructions = r.CollectionCode is null
            ? null
            : r.DeliveryInstructions ?? DefaultDeliveryInstructions(r.Delivery),
        FulfilledAt = r.FulfilledAt,
        CreatedAt = r.CreatedAt,
        UpdatedAt = r.UpdatedAt
    };
}
