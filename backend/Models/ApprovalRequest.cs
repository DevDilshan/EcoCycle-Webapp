using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backend.Models;

public enum ApprovalStatus
{
    Pending,
    Approved,
    Rejected,
    RevisionRequested
}

[Table("ApprovalRequests")]
public class ApprovalRequest
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid PickupRequestId { get; set; }

    [ForeignKey(nameof(PickupRequestId))]
    public PickupRequest? PickupRequest { get; set; }

    [Required]
    [MaxLength(2000)]
    public string FlagReason { get; set; } = string.Empty;

    [Required]
    public ApprovalStatus Status { get; set; } = ApprovalStatus.Pending;

    public Guid? ReviewedByAdminId { get; set; }

    [ForeignKey(nameof(ReviewedByAdminId))]
    public Profile? ReviewedByAdmin { get; set; }

    public DateTime? ReviewedAt { get; set; }

    [MaxLength(2000)]
    public string? ReviewNotes { get; set; }

    /// <summary>
    /// The full JSON body returned by the agent service's /run-pipeline call
    /// (classification, validation, routing, approval), stored verbatim as text.
    /// It is posted back to /route-approved-pickup when an admin approves, so the
    /// pickup can be assigned a collector without re-running the classifier.
    /// Deliberately untyped: the agent service owns this shape, and parsing it
    /// here would mean a C# change every time Python adds a field.
    /// Null for rows created before this column existed, or by any path that
    /// did not come from the agent pipeline.
    /// </summary>
    [Column(TypeName = "text")]
    public string? PipelineResultJson { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
