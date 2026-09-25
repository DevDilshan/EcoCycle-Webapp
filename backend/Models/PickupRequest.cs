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
    /// Nullable because it was added after pickups already existed, and because a
    /// resident has no way to supply one yet.
    /// TODO: this should be resident-selected at submission, or derived from the
    /// resident's address, rather than defaulted server-side to the first active
    /// zone. Until then PickupRequestService falls back to that default.
    /// </summary>
    public Guid? ZoneId { get; set; }

    [ForeignKey(nameof(ZoneId))]
    public Zone? Zone { get; set; }

    public bool IsRecurring { get; set; } = false;

    public string? RecurrenceInterval { get; set; } // e.g. "weekly", "bi-weekly"

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
