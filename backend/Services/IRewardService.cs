using backend.DTOs;

namespace backend.Services;

public interface IRewardService
{
    Task<RewardPointResponseDto> AwardAsync(AwardRewardPointsDto dto);

    Task<RewardHistoryResponseDto?> GetHistoryAsync(
        Guid residentId,
        Guid currentUserId,
        bool isAdmin,
        RewardHistoryQueryParams query);

    Task<RewardPointResponseDto?> GetByIdAsync(Guid id, Guid currentUserId, bool isAdmin);

    Task<RewardPointResponseDto?> UpdateAsync(Guid id, UpdateRewardPointDto dto);

    Task<bool> DeleteAsync(Guid id);

    Task<IReadOnlyList<RewardLeaderboardEntryDto>> GetLeaderboardAsync(int limit);

    Task<RewardRedemptionResponseDto> RedeemAsync(
        Guid residentId,
        RedeemRewardPointsDto dto);
}
