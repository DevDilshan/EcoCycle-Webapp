using backend.DTOs;

namespace backend.Services;

public interface IPickupRequestService
{
    Task<PickupRequestResponseDto> CreateAsync(Guid residentId, CreatePickupRequestDto dto);

    // isAdmin = true → sees all; false → scoped to residentId
    Task<PagedResult<PickupRequestResponseDto>> GetListAsync(
        Guid residentId, bool isAdmin, PickupRequestQueryParams query);

    Task<PickupRequestResponseDto?> GetByIdAsync(Guid id, Guid residentId, bool isAdmin);

    Task<PickupStatusDto?> GetStatusAsync(Guid id, Guid residentId, bool isAdmin);

    // returns null = not found; throws for forbidden / not-pending (see enum below)
    Task<PickupRequestResponseDto?> UpdateAsync(
        Guid id, Guid residentId, bool isAdmin, UpdatePickupRequestDto dto);

    Task<PickupOperationResult> DeleteAsync(Guid id, Guid residentId, bool isAdmin);
}

public enum PickupOperationResult
{
    Success,
    NotFound,
    Forbidden,
    NotEditable   // e.g. trying to cancel a request that isn't Pending
}