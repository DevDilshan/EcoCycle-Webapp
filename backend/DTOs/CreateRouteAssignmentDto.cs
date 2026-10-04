using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

public class CreateRouteAssignmentDto : IValidatableObject
{
    [Required]
    public Guid PickupRequestId { get; set; }

    [Required]
    public Guid CollectorId { get; set; }

    [Required]
    public Guid ZoneId { get; set; }

    [Required]
    public DateTime ScheduledDate { get; set; }

    /// <summary>
    /// How far ahead a stop may be booked. The same year the pickup form allows,
    /// so the two cannot disagree about what is a plausible date.
    /// </summary>
    private const int MaxFutureDays = 365;

    /// <summary>
    /// Checks the things the attributes above cannot.
    /// </summary>
    /// <remarks>
    /// [Required] does nothing on a non-nullable Guid: the property always has a
    /// value, and that value is Guid.Empty when the client omitted it or sent
    /// null. Every id here was therefore effectively optional, and an empty one
    /// reached the database as a foreign key to nothing.
    ///
    /// The date is bounded for the same reason the pickup form bounds it: a stop
    /// in the past cannot be driven, and one in 2043 is a typo rather than a
    /// plan.
    /// </remarks>
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (PickupRequestId == Guid.Empty)
            yield return new ValidationResult(
                "A pickup request is required.", new[] { "pickupRequestId" });

        if (CollectorId == Guid.Empty)
            yield return new ValidationResult(
                "A collector is required.", new[] { "collectorId" });

        if (ZoneId == Guid.Empty)
            yield return new ValidationResult(
                "A zone is required.", new[] { "zoneId" });

        if (ScheduledDate == default)
        {
            yield return new ValidationResult(
                "A scheduled date is required.", new[] { "scheduledDate" });
            yield break;
        }

        var today = DateTime.UtcNow.Date;
        if (ScheduledDate.Date < today)
            yield return new ValidationResult(
                "A stop cannot be scheduled in the past.", new[] { "scheduledDate" });
        else if (ScheduledDate.Date > today.AddDays(MaxFutureDays))
            yield return new ValidationResult(
                "A stop must be scheduled within the next 12 months.",
                new[] { "scheduledDate" });
    }
}
