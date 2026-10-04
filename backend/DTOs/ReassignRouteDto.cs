using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

public class ReassignRouteDto : IValidatableObject
{
    [Required]
    public Guid NewCollectorId { get; set; }

    /// <remarks>
    /// [Required] on a non-nullable Guid is a no-op: an omitted id arrives as
    /// Guid.Empty, which passed validation and then reassigned the stop to
    /// nobody.
    /// </remarks>
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (NewCollectorId == Guid.Empty)
            yield return new ValidationResult(
                "A collector is required.", new[] { "newCollectorId" });
    }
}
