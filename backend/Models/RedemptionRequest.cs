using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backend.Models;

public enum RedemptionStatus
{
    Pending,
    Approved,
    Rejected
}

// A resident's request to spend points. Points only leave the ledger when an
// admin approves; until then the request is editable and cancellable.
[Table("RedemptionRequests")]
public class RedemptionRequest
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid ResidentId { get; set; }

    [ForeignKey(nameof(ResidentId))]
    public Profile? Resident { get; set; }

    // The catalog item requested. Null once the item has been deleted; the
    // name and cost below are a copy taken at request time so history stays readable.
    public Guid? RewardItemId { get; set; }

    [ForeignKey(nameof(RewardItemId))]
    public RewardItem? RewardItem { get; set; }

    [Required]
    public int Points { get; set; }

    // Name of the item when it was requested.
    [Required]
    [MaxLength(480)]
    public string Reason { get; set; } = string.Empty;

    [Required]
    public RedemptionStatus Status { get; set; } = RedemptionStatus.Pending;

    [MaxLength(500)]
    public string? AdminNote { get; set; }

    public Guid? ReviewedByAdminId { get; set; }

    [ForeignKey(nameof(ReviewedByAdminId))]
    public Profile? ReviewedByAdmin { get; set; }

    public DateTime? ReviewedAt { get; set; }

    // Copied from the item when it is requested, like the name and cost.
    public RewardDelivery Delivery { get; set; } = RewardDelivery.Collect;

    // Where to post the item. Only asked for, and only kept, for posted items.
    [MaxLength(300)]
    public string? DeliveryAddress { get; set; }

    // Issued on approval. Shown at the counter to collect, or quoted as a reference.
    [MaxLength(16)]
    public string? CollectionCode { get; set; }

    // The item's instructions, copied on approval so they survive item edits.
    [MaxLength(300)]
    public string? DeliveryInstructions { get; set; }

    // Set when an admin hands over, emails or posts the item; once only.
    public DateTime? FulfilledAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
