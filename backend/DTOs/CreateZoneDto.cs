using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

public class CreateZoneDto
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    public Guid? AssignedCollectorId { get; set; }

    public double? Latitude { get; set; }

    public double? Longitude { get; set; }

    public bool IsActive { get; set; } = true;
}
