using backend.DTOs;

namespace backend.Services;

public interface IValidationService
{
    // Runs the Student 3 rules on a classified pickup.
    // null = pickup not found; throws InvalidOperationException if it isn't classified yet.
    Task<ValidationResultDto?> ValidateAsync(Guid pickupRequestId);
}
