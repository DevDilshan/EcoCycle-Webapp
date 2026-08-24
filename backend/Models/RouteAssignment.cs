using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backend.Models;

public enum RouteCompletionStatus
{
    Pending,
    Completed,
    Missed
}

[Table("RouteAssignments")]
public class RouteAssignment
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid PickupRequestId { get; set; }

    [ForeignKey(nameof(PickupRequestId))]
    public PickupRequest? PickupRequest { get; set; }

    [Required]
    public Guid CollectorId { get; set; }

    [ForeignKey(nameof(CollectorId))]
    public Profile? Collector { get; set; }

    [Required]
    public Guid ZoneId { get; set; }

    [ForeignKey(nameof(ZoneId))]
    public Zone? Zone { get; set; }

    [Required]
    public DateTime ScheduledDate { get; set; }

    [Required]
    public RouteCompletionStatus CompletionStatus { get; set; } = RouteCompletionStatus.Pending;

    public DateTime? CompletedAt { get; set; }

    [MaxLength(500)]
    public string? IssueNotes { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}