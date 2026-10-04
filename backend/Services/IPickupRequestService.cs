using backend.DTOs;

namespace backend.Services;

public interface IPickupRequestService
{
    /// <summary>What is left of a resident's bulky-waste allowance this month.</summary>
    /// <summary>Whether a resident may ask for this pickup again.</summary>
    Task<(bool NotFound, string? Reason)> CanRequestAgainAsync(Guid residentId, Guid pickupRequestId);

    Task<BulkAllowanceDto> GetBulkAllowanceAsync(Guid residentId);

    Task<PickupRequestResponseDto> CreateAsync(Guid residentId, CreatePickupRequestDto dto);

    /// <summary>Run the agent pipeline now and return the updated pickup (admin retry).</summary>
    Task<(PickupRequestResponseDto? Pickup, string? Error)> RunAgentPipelineNowAsync(Guid pickupRequestId);

    // isAdmin = true → sees all; false → scoped to residentId
    Task<PagedResult<PickupRequestResponseDto>> GetListAsync(
        Guid residentId, bool isAdmin, bool isCollector, PickupRequestQueryParams query);

    Task<PickupRequestResponseDto?> GetByIdAsync(Guid id, Guid residentId, bool isAdmin);

    Task<PickupStatusDto?> GetStatusAsync(Guid id, Guid residentId, bool isAdmin);

    // returns null = not found; throws for forbidden / not-pending (see enum below)
    Task<PickupRequestResponseDto?> UpdateAsync(
        Guid id, Guid residentId, bool isAdmin, UpdatePickupRequestDto dto);

    Task<PickupOperationResult> DeleteAsync(Guid id, Guid residentId, bool isAdmin);

    // Stub classifier: sets a category and moves Pending -> Classified.
    // null = not found; throws InvalidOperationException if not Pending.
    Task<ClassifyResponseDto?> ClassifyAsync(Guid id);
}

public enum PickupOperationResult
{
    Success,
    NotFound,
    Forbidden,
    NotEditable,          // the pickup is already finished, so it cannot be cancelled
    CancelWindowExpired   // the 30-minute cancellation window has passed
}