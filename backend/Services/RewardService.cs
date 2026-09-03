using backend.Data;
using backend.DTOs;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class RewardService : IRewardService
{
    private readonly ApplicationDbContext _db;

    public RewardService(ApplicationDbContext db) => _db = db;

    public async Task<RewardPointResponseDto> AwardAsync(AwardRewardPointsDto dto)
    {
        ValidateIds(dto.ResidentId, dto.PickupRequestId);

        if (!await _db.Profiles.AnyAsync(p => p.Id == dto.ResidentId))
            throw new KeyNotFoundException("Resident not found.");

        await EnsurePickupBelongsToResidentAsync(dto.PickupRequestId, dto.ResidentId);

        var reward = new RewardPoint
        {
            ResidentId = dto.ResidentId,
            PickupRequestId = dto.PickupRequestId,
            PointsEarned = dto.PointsEarned,
            Reason = RequireReason(dto.Reason),
            CreatedAt = DateTime.UtcNow
        };

        _db.RewardPoints.Add(reward);
        await _db.SaveChangesAsync();

        return ToDto(reward);
    }

    public async Task<RewardHistoryResponseDto?> GetHistoryAsync(
        Guid residentId,
        Guid currentUserId,
        bool isAdmin,
        RewardHistoryQueryParams query)
    {
        if (!isAdmin && residentId != currentUserId)
            return null;

        if (!await _db.Profiles.AsNoTracking().AnyAsync(p => p.Id == residentId))
            return null;

        var allRewards = _db.RewardPoints
            .AsNoTracking()
            .Where(r => r.ResidentId == residentId);

        var balance = await allRewards.SumAsync(r => (int?)r.PointsEarned) ?? 0;
        var filteredRewards = allRewards;

        var normalizedFrom = query.FromDate.HasValue
            ? NormalizeToUtc(query.FromDate.Value)
            : (DateTime?)null;
        var normalizedTo = query.ToDate.HasValue
            ? NormalizeToUtc(query.ToDate.Value)
            : (DateTime?)null;

        if (normalizedFrom.HasValue && normalizedTo.HasValue && normalizedFrom > normalizedTo)
            throw new ArgumentException("FromDate cannot be later than ToDate.");

        if (normalizedFrom.HasValue)
        {
            filteredRewards = filteredRewards.Where(r => r.CreatedAt >= normalizedFrom.Value);
        }

        if (normalizedTo.HasValue)
        {
            // A date-only value represents the full UTC day, not only midnight.
            if (query.ToDate!.Value.TimeOfDay == TimeSpan.Zero)
            {
                var exclusiveEnd = normalizedTo.Value.AddDays(1);
                filteredRewards = filteredRewards.Where(r => r.CreatedAt < exclusiveEnd);
            }
            else
            {
                filteredRewards = filteredRewards.Where(r => r.CreatedAt <= normalizedTo.Value);
            }
        }

        var total = await filteredRewards.CountAsync();
        var descending = !string.Equals(query.SortDir, "asc", StringComparison.OrdinalIgnoreCase);
        filteredRewards = descending
            ? filteredRewards.OrderByDescending(r => r.CreatedAt)
            : filteredRewards.OrderBy(r => r.CreatedAt);

        var items = await filteredRewards
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(r => ToDto(r))
            .ToListAsync();

        return new RewardHistoryResponseDto
        {
            ResidentId = residentId,
            CurrentBalance = balance,
            Items = items,
            Page = query.Page,
            PageSize = query.PageSize,
            TotalCount = total
        };
    }

    public async Task<RewardPointResponseDto?> GetByIdAsync(
        Guid id,
        Guid currentUserId,
        bool isAdmin)
    {
        var reward = await _db.RewardPoints
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == id);

        if (reward is null || (!isAdmin && reward.ResidentId != currentUserId))
            return null;

        return ToDto(reward);
    }

    public async Task<RewardPointResponseDto?> UpdateAsync(Guid id, UpdateRewardPointDto dto)
    {
        if (dto.PointsEarned == 0)
            throw new ArgumentException("PointsEarned cannot be zero.");

        var reward = await _db.RewardPoints.FirstOrDefaultAsync(r => r.Id == id);
        if (reward is null)
            return null;

        reward.PointsEarned = dto.PointsEarned;
        reward.Reason = RequireReason(dto.Reason);

        await _db.SaveChangesAsync();
        return ToDto(reward);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var reward = await _db.RewardPoints.FirstOrDefaultAsync(r => r.Id == id);
        if (reward is null)
            return false;

        _db.RewardPoints.Remove(reward);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<IReadOnlyList<RewardLeaderboardEntryDto>> GetLeaderboardAsync(int limit)
    {
        limit = Math.Clamp(limit, 1, 100);
        var monthStart = new DateTime(
            DateTime.UtcNow.Year,
            DateTime.UtcNow.Month,
            1,
            0,
            0,
            0,
            DateTimeKind.Utc);

        var totals = await _db.RewardPoints
            .AsNoTracking()
            .Where(r => r.CreatedAt >= monthStart && r.PointsEarned > 0)
            .GroupBy(r => r.ResidentId)
            .Select(group => new
            {
                ResidentId = group.Key,
                PointsEarned = group.Sum(r => r.PointsEarned)
            })
            .OrderByDescending(entry => entry.PointsEarned)
            .ThenBy(entry => entry.ResidentId)
            .Take(limit)
            .ToListAsync();

        var residentIds = totals.Select(entry => entry.ResidentId).ToList();
        var names = await _db.Profiles
            .AsNoTracking()
            .Where(profile => residentIds.Contains(profile.Id))
            .ToDictionaryAsync(
                profile => profile.Id,
                profile => profile.FullName ?? profile.Email);

        return totals.Select((entry, index) => new RewardLeaderboardEntryDto
        {
            Rank = index + 1,
            ResidentId = entry.ResidentId,
            ResidentName = names.GetValueOrDefault(entry.ResidentId, "Unknown resident"),
            PointsEarned = entry.PointsEarned
        }).ToList();
    }

    public async Task<RewardRedemptionResponseDto> RedeemAsync(
        Guid residentId,
        RedeemRewardPointsDto dto)
    {
        ValidateIds(residentId, dto.PickupRequestId);
        await EnsurePickupBelongsToResidentAsync(dto.PickupRequestId, residentId);

        var balance = await _db.RewardPoints
            .Where(r => r.ResidentId == residentId)
            .SumAsync(r => (int?)r.PointsEarned) ?? 0;

        if (balance < dto.Points)
            throw new InvalidOperationException("Insufficient reward points.");

        var redemption = new RewardPoint
        {
            ResidentId = residentId,
            PickupRequestId = dto.PickupRequestId,
            PointsEarned = -dto.Points,
            Reason = $"Redemption: {RequireReason(dto.Reason)}",
            CreatedAt = DateTime.UtcNow
        };

        _db.RewardPoints.Add(redemption);
        await _db.SaveChangesAsync();

        return new RewardRedemptionResponseDto
        {
            Transaction = ToDto(redemption),
            RemainingBalance = balance - dto.Points
        };
    }

    private async Task EnsurePickupBelongsToResidentAsync(Guid pickupRequestId, Guid residentId)
    {
        var pickup = await _db.PickupRequests
            .AsNoTracking()
            .Where(p => p.Id == pickupRequestId)
            .Select(p => new { p.ResidentId })
            .FirstOrDefaultAsync();

        if (pickup is null)
            throw new KeyNotFoundException("Pickup request not found.");

        if (pickup.ResidentId != residentId)
            throw new ArgumentException("The pickup request does not belong to the specified resident.");
    }

    private static void ValidateIds(Guid residentId, Guid pickupRequestId)
    {
        if (residentId == Guid.Empty)
            throw new ArgumentException("ResidentId is required.");
        if (pickupRequestId == Guid.Empty)
            throw new ArgumentException("PickupRequestId is required.");
    }

    private static DateTime NormalizeToUtc(DateTime value) =>
        value.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(value, DateTimeKind.Utc)
            : value.ToUniversalTime();

    private static string RequireReason(string reason)
    {
        var trimmed = reason.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
            throw new ArgumentException("Reason is required.");
        return trimmed;
    }

    private static RewardPointResponseDto ToDto(RewardPoint reward) => new()
    {
        Id = reward.Id,
        ResidentId = reward.ResidentId,
        PickupRequestId = reward.PickupRequestId,
        PointsEarned = reward.PointsEarned,
        Reason = reward.Reason,
        CreatedAt = reward.CreatedAt
    };
}
