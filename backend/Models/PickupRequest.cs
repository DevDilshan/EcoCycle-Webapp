using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backend.Models;

public enum PickupStatus
{
    Pending,
    Classified,
    Approved,
    Scheduled,
    Completed
}

[Table("PickupRequests")]
public class PickupRequest
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid ResidentId { get; set; }

    [ForeignKey(nameof(ResidentId))]
    public Profile? Resident { get; set; }

    public string? PhotoUrl { get; set; }

    [MaxLength(1000)]
    public string? Description { get; set; }

    [Required]
    public DateTime PreferredDate { get; set; }

    [Required]
    public PickupStatus Status { get; set; } = PickupStatus.Pending;

    public bool IsRecurring { get; set; } = false;

    public string? RecurrenceInterval { get; set; } // e.g. "weekly", "bi-weekly"

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
