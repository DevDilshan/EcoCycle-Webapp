using backend.Data;
using backend.DTOs;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class RewardItemService : IRewardItemService
{
    private readonly ApplicationDbContext _db;

    public RewardItemService(ApplicationDbContext db) => _db = db;

    public async Task<PagedResult<RewardItemResponseDto>> GetListAsync(bool isAdmin, RewardItemQueryParams query)
    {
        var q = _db.RewardItems.AsNoTracking().AsQueryable();

        if (!isAdmin)
            q = q.Where(i => i.IsActive);
        else if (query.IsActive.HasValue)
            q = q.Where(i => i.IsActive == query.IsActive.Value);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            q = q.Where(i => i.Name.ToLower().Contains(term)
                || (i.Description != null && i.Description.ToLower().Contains(term)));
        }

        var desc = string.Equals(query.SortDir, "desc", StringComparison.OrdinalIgnoreCase);
        q = query.SortBy?.ToLowerInvariant() switch
        {
            "name" => desc ? q.OrderByDescending(i => i.Name) : q.OrderBy(i => i.Name),
            "createdat" => desc ? q.OrderByDescending(i => i.CreatedAt) : q.OrderBy(i => i.CreatedAt),
            _ => desc ? q.OrderByDescending(i => i.PointsCost) : q.OrderBy(i => i.PointsCost),
        };

        var total = await q.CountAsync();
        var rows = await q
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return new PagedResult<RewardItemResponseDto>
        {
            Items = rows.Select(ToDto).ToList(),
            Page = query.Page,
            PageSize = query.PageSize,
            TotalCount = total
        };
    }

    public async Task<RewardItemResponseDto?> GetByIdAsync(Guid id, bool isAdmin)
    {
        var item = await _db.RewardItems.AsNoTracking().FirstOrDefaultAsync(i => i.Id == id);
        if (item is null || (!isAdmin && !item.IsActive))
            return null;

        return ToDto(item);
    }

    public async Task<RewardItemResponseDto> CreateAsync(SaveRewardItemDto dto)
    {
        var item = new RewardItem();
        Apply(item, dto);
        _db.RewardItems.Add(item);
        await _db.SaveChangesAsync();
        return ToDto(item);
    }

    public async Task<RewardItemResponseDto?> UpdateAsync(Guid id, SaveRewardItemDto dto)
    {
        var item = await _db.RewardItems.FirstOrDefaultAsync(i => i.Id == id);
        if (item is null)
            return null;

        Apply(item, dto);
        item.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return ToDto(item);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var item = await _db.RewardItems.FirstOrDefaultAsync(i => i.Id == id);
        if (item is null)
            return false;

        var hasPending = await _db.RedemptionRequests.AnyAsync(r =>
            r.RewardItemId == id && r.Status == RedemptionStatus.Pending);
        if (hasPending)
            throw new InvalidOperationException(
                "This item has pending redemption requests. Deactivate it instead, or decide those requests first.");

        // Past requests keep their own copy of the name and cost, so history survives.
        _db.RewardItems.Remove(item);
        await _db.SaveChangesAsync();
        return true;
    }

    private static void Apply(RewardItem item, SaveRewardItemDto dto)
    {
        var name = dto.Name.Trim();
        if (name.Length == 0)
            throw new ArgumentException("Name is required.");

        item.Name = name;
        item.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
        item.PointsCost = dto.PointsCost;
        item.Stock = dto.Stock;
        item.IsActive = dto.IsActive;
    }

    private static RewardItemResponseDto ToDto(RewardItem i) => new()
    {
        Id = i.Id,
        Name = i.Name,
        Description = i.Description,
        PointsCost = i.PointsCost,
        Stock = i.Stock,
        IsActive = i.IsActive,
        CreatedAt = i.CreatedAt,
        UpdatedAt = i.UpdatedAt
    };
}
