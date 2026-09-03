using backend.DTOs;

namespace backend.Services;

public interface IComplaintService
{
    Task<ComplaintResponseDto> CreateAsync(Guid residentId, CreateComplaintDto dto);

    Task<PagedResult<ComplaintResponseDto>> GetListAsync(ComplaintQueryParams query);

    Task<ComplaintResponseDto?> GetByIdAsync(Guid id, Guid userId, bool isAdmin);

    Task<ComplaintResponseDto?> UpdateAsync(Guid id, UpdateComplaintDto dto);

    Task<bool> DeleteAsync(Guid id);
}
