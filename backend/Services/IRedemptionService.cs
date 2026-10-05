using backend.DTOs;

namespace backend.Services;

public interface IRedemptionService
{
    Task<RedemptionResponseDto> CreateAsync(Guid residentId, CreateRedemptionDto dto);

    // Admins see every request; residents only their own.
    Task<PagedResult<RedemptionResponseDto>> GetListAsync(
        Guid currentUserId, bool isAdmin, RedemptionQueryParams query);

    Task<RedemptionResponseDto?> GetByIdAsync(Guid id, Guid currentUserId, bool isAdmin);

    // Returns null when the request does not exist or is not the resident's.
    Task<RedemptionResponseDto?> UpdateAsync(Guid id, Guid residentId, UpdateRedemptionDto dto);

    Task<bool> DeleteAsync(Guid id, Guid residentId);

    Task<RedemptionResponseDto?> ApproveAsync(Guid id, Guid adminId, ReviewRedemptionDto dto);

    Task<RedemptionResponseDto?> RejectAsync(Guid id, Guid adminId, ReviewRedemptionDto dto);

    // Records that an approved item was handed over, emailed or posted.
    Task<RedemptionResponseDto?> FulfilAsync(Guid id);
}
