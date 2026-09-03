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
}
