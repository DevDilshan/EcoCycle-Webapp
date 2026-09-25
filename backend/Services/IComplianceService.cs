using backend.DTOs;

namespace backend.Services;

public interface IComplianceService
{
    Task<ClassificationResultDto> ClassifyAndEvaluateAsync(Guid pickupRequestId, ClassifyPickupRequestDto dto);
}
