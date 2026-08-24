using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backend.Models;

[Table("ComplianceViolations")]
public class ComplianceViolation
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
    [MaxLength(500)]
    public string RuleViolated { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
