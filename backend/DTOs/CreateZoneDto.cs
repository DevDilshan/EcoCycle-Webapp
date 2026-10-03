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

    /// <summary>
    /// Days of the week this zone is collected, as DayOfWeek numbers
    /// (0 = Sunday ... 6 = Saturday). Empty means no fixed days.
    /// </summary>
    public List<int> CollectionDays { get; set; } = [];

    public bool IsActive { get; set; } = true;
}
