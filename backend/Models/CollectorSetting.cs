using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backend.Models;

/// <summary>
/// What one collector's round can take: how many stops a day, and which
/// restricted categories their vehicle is equipped for.
/// </summary>
/// <remarks>
/// A separate table rather than columns on Profile, because profiles is owned by
/// Supabase and excluded from migrations -- this side cannot add columns to it.
///
/// A collector with no row here is treated as having the defaults below, so the
/// feature works before anyone fills anything in.
/// </remarks>
[Table("CollectorSettings")]
public class CollectorSetting
{
    [Key]
    public Guid CollectorId { get; set; }

    [ForeignKey(nameof(CollectorId))]
    public Profile? Collector { get; set; }

    /// <summary>Stops this collector can take in one day.</summary>
    public int DailyCapacity { get; set; } = 10;

    /// <summary>Their vehicle has a lift, so it can take bulky items.</summary>
    public bool HandlesBulky { get; set; } = true;

    /// <summary>They are licensed to carry hazardous waste.</summary>
    public bool HandlesHazardous { get; set; } = false;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
