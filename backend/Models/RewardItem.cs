using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backend.Models;

// Something a resident can spend points on. Admins manage the catalog;
// residents pick from the active items when they request a redemption.
[Table("RewardItems")]
public class RewardItem
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(120)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    [Required]
    public int PointsCost { get; set; }

    // Null means unlimited (e.g. a donation). Otherwise the number left.
    public int? Stock { get; set; }

    // Inactive items stay in the catalog for admins but residents cannot pick them.
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
