using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backend.Models;

public enum ComplaintStatus
{
    Open,
    InProgress,
    Resolved
}

[Table("Complaints")]
public class Complaint
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid ResidentId { get; set; }

    [ForeignKey(nameof(ResidentId))]
    public Profile? Resident { get; set; }

    [Required]
    public Guid PickupRequestId { get; set; }

    [ForeignKey(nameof(PickupRequestId))]
    public PickupRequest? PickupRequest { get; set; }

    [Required]
    [MaxLength(2000)]
    public string Description { get; set; } = string.Empty;

    [Required]
    public ComplaintStatus Status { get; set; } = ComplaintStatus.Open;

    public DateTime? ResolvedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
