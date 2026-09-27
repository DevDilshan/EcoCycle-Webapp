namespace backend.DTOs;

public class ZoneDto
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public Guid? AssignedCollectorId { get; set; }

    public double? Latitude { get; set; }

    public double? Longitude { get; set; }

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
}
