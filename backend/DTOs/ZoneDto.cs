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
