using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using backend.Models;

namespace backend.DTOs;

public class CreateRedemptionDto
{
    [Required]
    public Guid RewardItemId { get; set; }

    // Required when the item is posted; ignored otherwise.
    [MaxLength(300)]
    public string? DeliveryAddress { get; set; }
}

// A pending request can be switched to a different catalog item.
public class UpdateRedemptionDto
{
    [Required]
    public Guid RewardItemId { get; set; }

    // Required when the item is posted; ignored otherwise.
    [MaxLength(300)]
    public string? DeliveryAddress { get; set; }
}

public class ReviewRedemptionDto
{
    [MaxLength(500)]
    public string? AdminNote { get; set; }
}

public class RedemptionResponseDto
{
    public Guid Id { get; set; }
    public Guid ResidentId { get; set; }
    public string ResidentName { get; set; } = string.Empty;
    public string ResidentEmail { get; set; } = string.Empty;
    public Guid? RewardItemId { get; set; }
    public int Points { get; set; }
    public string Reason { get; set; } = string.Empty;

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public RedemptionStatus Status { get; set; }

    public string? AdminNote { get; set; }
    public DateTime? ReviewedAt { get; set; }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public RewardDelivery Delivery { get; set; }
    public string? DeliveryAddress { get; set; }

    // Null until approved.
    public string? CollectionCode { get; set; }
    public string? DeliveryInstructions { get; set; }
    public DateTime? FulfilledAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

// Bound from the query string on GET /api/redemptions
public class RedemptionQueryParams
{
    public RedemptionStatus? Status { get; set; }       // ?status=Pending
    public string? Search { get; set; }                 // resident name, email, item name or collection code

    public string? SortBy { get; set; } = "createdAt";  // createdAt | points | status
    public string? SortDir { get; set; } = "desc";      // asc | desc

    private int _page = 1;
    public int Page { get => _page; set => _page = value < 1 ? 1 : value; }

    private int _pageSize = 10;
    public int PageSize
    {
        get => _pageSize;
        set => _pageSize = value is < 1 or > 100 ? 10 : value;
    }
}
