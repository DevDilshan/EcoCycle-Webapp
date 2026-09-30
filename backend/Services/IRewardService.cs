using backend.DTOs;
using backend.Models;

namespace backend.Services;

public interface IRewardService
{
    Task<RewardPointResponseDto> AwardAsync(AwardRewardPointsDto dto);

    /// <summary>
    /// Works out the points for a collected pickup and adds them to the
    /// context WITHOUT saving, so the caller commits them in the same
    /// transaction as the completion. Returns null when nothing is awarded
    /// (already awarded, not classified, or worth zero points).
    /// </summary>
    Task<RewardPoint?> StageCompletionAwardAsync(Guid pickupRequestId);

    Task<RewardHistoryResponseDto?> GetHistoryAsync(
        Guid residentId,
        Guid currentUserId,
        bool isAdmin,
        RewardHistoryQueryParams query);

    Task<RewardPointResponseDto?> GetByIdAsync(Guid id, Guid currentUserId, bool isAdmin);

    Task<RewardPointResponseDto?> UpdateAsync(Guid id, UpdateRewardPointDto dto);

    Task<bool> DeleteAsync(Guid id);

    Task<IReadOnlyList<RewardLeaderboardEntryDto>> GetLeaderboardAsync(int limit);
}
