using backend.DTOs;

namespace backend.Services;

public interface IApprovalService
{
    Task<ApprovalResponseDto?> ApproveAsync(Guid id, Guid adminId, ApproveApprovalDto dto);

    Task<ApprovalResponseDto?> RejectAsync(Guid id, Guid adminId, RejectApprovalDto dto);
}
