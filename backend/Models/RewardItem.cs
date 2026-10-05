using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backend.Models;

// How an approved reward reaches the resident.
public enum RewardDelivery
{
    Collect,   // in person, against the code
    Email,     // sent to the resident's account email
    Post       // posted to the address given with the request
}

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

    // A bundled catalog image path or an HTTPS image supplied by an admin.
    [MaxLength(2048)]
    public string? ImageUrl { get; set; }

    [Required]
    public int PointsCost { get; set; }

    // Null means unlimited (e.g. a donation). Otherwise the number left.
    public int? Stock { get; set; }

    public RewardDelivery Delivery { get; set; } = RewardDelivery.Collect;

    // Shown to the resident with their code once a request is approved.
    [MaxLength(300)]
    public string? DeliveryInstructions { get; set; }

    // Inactive items stay in the catalog for admins but residents cannot pick them.
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
