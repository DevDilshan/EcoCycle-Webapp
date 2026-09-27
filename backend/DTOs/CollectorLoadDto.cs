namespace backend.DTOs;

public class CollectorLoadDto
{
    public Guid CollectorId { get; set; }

    public int TotalAssignments { get; set; }

    public int PendingAssignments { get; set; }

    public int CompletedAssignments { get; set; }

    public int MissedAssignments { get; set; }
}

/// <summary>
/// Real pickup counts for one zone, taken from RouteAssignments.ZoneId.
/// </summary>
/// <remarks>
/// Deliberately counts rather than a percentage: nothing in the system records
/// a zone's capacity, so any "% loaded" figure would be invented. Counts are
/// something an admin can act on and verify.
/// </remarks>
public class ZoneLoadDto
{
    public Guid ZoneId { get; set; }
    public string ZoneName { get; set; } = string.Empty;

    /// <summary>Assignments in this zone still waiting to be collected.</summary>
    public int PendingAssignments { get; set; }

    /// <summary>Of those, the ones scheduled for today (UTC).</summary>
    public int DueToday { get; set; }

    public int CompletedAssignments { get; set; }
    public int MissedAssignments { get; set; }
    public int TotalAssignments { get; set; }
}
