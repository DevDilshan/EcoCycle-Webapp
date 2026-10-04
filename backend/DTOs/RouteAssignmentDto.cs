using backend.Models;

namespace backend.DTOs;

public class RouteAssignmentDto
{
    public Guid Id { get; set; }

    public Guid PickupRequestId { get; set; }

    public Guid CollectorId { get; set; }

    public Guid ZoneId { get; set; }

    public DateTime ScheduledDate { get; set; }

    public RouteCompletionStatus CompletionStatus { get; set; }

    public DateTime? CompletedAt { get; set; }

    public string? IssueNotes { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    // --- The stop's own detail, joined from its pickup and that resident's
    // profile. On the stop rather than fetched separately because a stop used to
    // carry nothing but ids: the collector screens pulled
    // /pickuprequests?pageSize=100 and matched in the browser, which silently
    // lost detail past the hundredth row and handed every collector a list of
    // requests that were not theirs. These queries are already filtered to one
    // collector, so scoping comes from the query rather than from a check
    // somebody has to remember.

    /// <summary>Who to ask for at the door.</summary>
    public string? ResidentName { get; set; }

    /// <summary>The number to ring from the kerb; null on older pickups.</summary>
    public string? ResidentPhone { get; set; }

    /// <summary>House number and street. The zone is a whole suburb.</summary>
    public string? Address { get; set; }

    /// <summary>The resident's own words about what is being collected.</summary>
    public string? Description { get; set; }

    /// <summary>Waste category as a string, null until classified.</summary>
    public string? Category { get; set; }

    /// <summary>Classifier certainty, 0..1.</summary>
    public double? Confidence { get; set; }

    /// <summary>The zone's name, for the round rather than the door.</summary>
    public string? ZoneName { get; set; }

    /// <summary>
    /// The zone's centre, so a stop can be drawn on a map.
    /// </summary>
    /// <remarks>
    /// The zone's point, not the stop's: nothing in this system geocodes a
    /// street address, so the centre of the zone is the only coordinate a stop
    /// has. Several stops in one zone therefore share a point, which the maps
    /// handle by numbering each marker rather than by pretending they are apart.
    ///
    /// Null for a zone that was never placed. Such a stop is still collectable;
    /// it just cannot be drawn.
    /// </remarks>
    public double? ZoneLatitude { get; set; }

    public double? ZoneLongitude { get; set; }

    /// <summary>
    /// Needs a lift-equipped vehicle, which the crew must know before they set off.
    /// </summary>
    public bool IsBulkRequest { get; set; }

    /// <summary>The photo the resident submitted, so the crew knows what to expect.</summary>
    public string? PhotoUrl { get; set; }

    /// <summary>When the pickup was asked for, which says how long it has waited.</summary>
    public DateTime? RequestedAt { get; set; }
}
