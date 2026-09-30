using backend.DTOs;

namespace backend.Services;

public interface IRewardItemService
{
    // Admins see everything (optionally filtered); residents only active items.
    Task<PagedResult<RewardItemResponseDto>> GetListAsync(bool isAdmin, RewardItemQueryParams query);

    Task<RewardItemResponseDto?> GetByIdAsync(Guid id, bool isAdmin);

    Task<RewardItemResponseDto> CreateAsync(SaveRewardItemDto dto);

    Task<RewardItemResponseDto?> UpdateAsync(Guid id, SaveRewardItemDto dto);

    // Refused while pending requests still point at the item.
    Task<bool> DeleteAsync(Guid id);
}
