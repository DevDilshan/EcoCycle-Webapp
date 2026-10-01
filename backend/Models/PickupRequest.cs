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

    /// <summary>
    /// The collection zone this pickup belongs to, used to route it to a collector.
    /// Chosen by the resident at submission and validated against the active
    /// zones. Still nullable because it was added after pickups already existed,
    /// so older rows have none.
    /// </summary>
    public Guid? ZoneId { get; set; }

    [ForeignKey(nameof(ZoneId))]
    public Zone? Zone { get; set; }

    /// <summary>
    /// The resident declared this a bulky-waste collection.
    /// </summary>
    /// <remarks>
    /// Deliberately separate from the classifier's Bulk category. A council
    /// enforces a bulky-waste allowance against what the resident booked, not
    /// against what a model inferred from a photo -- "furniture from the back
    /// room" might classify as General and slip the quota entirely.
    ///
    /// The classifier still runs, and a disagreement between the two (declared
    /// but not Bulk, or Bulk but not declared) is worth an admin's attention
    /// rather than being silently resolved either way.
    /// </remarks>
    public bool IsBulkRequest { get; set; } = false;

    public bool IsRecurring { get; set; } = false;

    public string? RecurrenceInterval { get; set; } // e.g. "weekly", "bi-weekly"

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
