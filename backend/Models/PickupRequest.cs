using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backend.Models;

public enum PickupStatus
{
    Pending,
    Classified,
    Approved,
    Scheduled,
    Completed,

    /// <summary>
    /// An admin refused this pickup; it will not be collected.
    /// </summary>
    /// <remarks>
    /// Added last on purpose. The column stores the enum as an integer, so
    /// inserting a value anywhere but the end would silently change what every
    /// existing row means -- Completed would become Scheduled across the table,
    /// with no error and no way to notice.
    ///
    /// Until this existed, rejecting an approval changed the approval and left
    /// the pickup sitting as Classified for ever: not scheduled, not refused,
    /// and never explained to the resident.
    /// </remarks>
    Rejected
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
    /// Where the collector actually goes: house number and street.
    /// </summary>
    /// <remarks>
    /// The zone says which round collects this and on which days; it is a whole
    /// suburb and cannot tell a driver which house. Without this the system
    /// schedules perfectly and the truck has nowhere to stop.
    ///
    /// Free text on purpose. A driver can read "14/2 Temple Road, near the
    /// junction"; they cannot read a pair of coordinates. A map pin can be added
    /// later for ordering the round, but it does not replace this.
    /// </remarks>
    [MaxLength(300)]
    public string? Address { get; set; }

    // Resident-confirmed pickup pin; older bookings have no coordinates.
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    /// <summary>
    /// A number the crew can call from the kerb, given by the resident on the
    /// request itself.
    /// </summary>
    /// <remarks>
    /// Kept on the pickup rather than the profile on purpose: the person to call
    /// is not always the account holder. A resident booking a collection at a
    /// relative's house needs the crew to reach whoever is actually there.
    ///
    /// Nullable because it was added after pickups already existed, so older
    /// rows carry none; new requests require one.
    /// </remarks>
    [MaxLength(20)]
    public string? ContactPhone { get; set; }

    /// <summary>
    /// The message shown to the resident after a failed attempt, written by the
    /// Notifier agent from the collector's shorthand.
    /// </summary>
    /// <remarks>
    /// Stored on the pickup rather than in an inbox: there is no notification
    /// system here, and the latest outcome is what a resident actually wants to
    /// see when they open their collection.
    /// </remarks>
    [MaxLength(1000)]
    public string? ResidentMessage { get; set; }

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
