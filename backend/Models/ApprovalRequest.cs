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

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
