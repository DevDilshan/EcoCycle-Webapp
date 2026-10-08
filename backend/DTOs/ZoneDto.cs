namespace backend.DTOs;

public class ZoneDto
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public Guid? AssignedCollectorId { get; set; }

    public double? Latitude { get; set; }

    public double? Longitude { get; set; }

    public string? BoundaryGeoJson { get; set; }

    public BoundaryReferenceDto? BoundaryReference { get; set; }
    public DateTime? BoundaryCoverageReviewedAt { get; set; }

    /// <summary>Collection days as DayOfWeek numbers; empty means no fixed days.</summary>
    public List<int> CollectionDays { get; set; } = [];

    public bool IsActive { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// A zone as the public landing page sees it.
/// </summary>
/// <remarks>
/// Deliberately minimal. ZoneDto carries AssignedCollectorId and IsActive, which
/// are operational details and must not be served anonymously, so the public
/// endpoint returns this instead of filtering ZoneDto down at the edge.
/// </remarks>
public class PublicZoneDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string? BoundaryGeoJson { get; set; }
}

/// <summary>
/// A zone as a chooser sees it: just enough to put in a dropdown.
/// </summary>
/// <remarks>
/// Separate from PublicZoneDto, which the landing map uses and which drops any
/// zone without coordinates. A zone with no lat/lng is still perfectly
/// routable, so it has to remain selectable when a resident books a pickup.
/// </remarks>
public class ZoneOptionDto
{
    public string? BoundaryGeoJson { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// The days this zone is collected, as DayOfWeek numbers. Sent so the
    /// submission form can say "Nugegoda is collected on Tuesdays and Fridays"
    /// instead of offering a date that can never be honoured.
    /// </summary>
    public List<int> CollectionDays { get; set; } = [];
}
