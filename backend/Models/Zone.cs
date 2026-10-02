using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backend.Models;

[Table("Zones")]
public class Zone
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    public Guid? AssignedCollectorId { get; set; }

    [ForeignKey(nameof(AssignedCollectorId))]
    public Profile? AssignedCollector { get; set; }

    public double? Latitude { get; set; }

    public double? Longitude { get; set; }

    /// <summary>
    /// Days of the week this zone is collected, as System.DayOfWeek numbers
    /// (0 = Sunday ... 6 = Saturday).
    /// </summary>
    /// <remarks>
    /// This is how real collection works: a zone has a round on fixed days
    /// rather than a truck being sent whenever something is booked.
    ///
    /// An empty list means "no fixed days", which is the safe default for zones
    /// that existed before this column: routing then falls back to scheduling as
    /// soon as capacity allows rather than refusing to schedule at all.
    /// </remarks>
    public List<int> CollectionDays { get; set; } = [];

    public bool IsActive { get; set; } = true;

    public DateTime? UpdatedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}