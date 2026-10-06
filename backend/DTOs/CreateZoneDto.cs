using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

public class CreateZoneDto : IValidatableObject
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    public Guid? AssignedCollectorId { get; set; }

    /// <remarks>
    /// Ranges are checked here as well as in Validate below, so Swagger and any
    /// generated client know the bounds without reading the method.
    /// </remarks>
    [Range(-90, 90, ErrorMessage = "Latitude must be between -90 and 90.")]
    public double? Latitude { get; set; }

    [Range(-180, 180, ErrorMessage = "Longitude must be between -180 and 180.")]
    public double? Longitude { get; set; }

    [MaxLength(backend.Validation.ZoneBoundary.MaxLength)]
    public string? BoundaryGeoJson { get; set; }

    public BoundaryReferenceDto? BoundaryReference { get; set; }
    public bool ConfirmCollectionCoverage { get; set; }

    /// <summary>
    /// Days of the week this zone is collected, as DayOfWeek numbers
    /// (0 = Sunday ... 6 = Saturday). Empty means no fixed days.
    /// </summary>
    public List<int> CollectionDays { get; set; } = [];

    public bool IsActive { get; set; } = true;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        var referenceError = backend.Validation.BoundaryReference.Validate(this);
        if (referenceError != null)
            yield return new ValidationResult(referenceError, new[] { "boundaryReference" });
        string? boundaryError = null;
        try { backend.Validation.ZoneBoundary.Parse(BoundaryGeoJson); }
        catch (ArgumentException ex) { boundaryError = ex.Message; }
        if (boundaryError != null)
            yield return new ValidationResult(boundaryError, new[] { "boundaryGeoJson" });
        // [Required] above already rejects null, empty and whitespace-only, and
        // when it fires this method is never reached at all. What it cannot say is
        // that one character is not a place name -- "D" saved happily and then sat
        // in every dropdown a resident picks from.
        var name = Name?.Trim() ?? "";
        if (name.Length is > 0 and < 2)
            yield return new ValidationResult(
                "A zone name must be at least 2 characters.", new[] { "name" });

        if (AssignedCollectorId == Guid.Empty)
            yield return new ValidationResult(
                "Choose a collector, or leave the zone unassigned.",
                new[] { "assignedCollectorId" });

        // Both or neither. One alone is not a location, and a zone with only a
        // latitude was silently treated as unplaced -- which looked like the
        // value had not saved.
        if (Latitude.HasValue != Longitude.HasValue)
            yield return new ValidationResult(
                "A location needs both a latitude and a longitude.",
                new[] { Latitude.HasValue ? "longitude" : "latitude" });

        // Rejected rather than quietly dropped. The service filters these out, so
        // a client sending 7 got a zone with no collection days and no indication
        // why the day it chose had vanished.
        var bad = (CollectionDays ?? []).Where(d => d is < 0 or > 6).Distinct().ToList();
        if (bad.Count > 0)
            yield return new ValidationResult(
                $"Collection days must be 0 (Sunday) to 6 (Saturday); got {string.Join(", ", bad)}.",
                new[] { "collectionDays" });
    }
}
