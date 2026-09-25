using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

public class AwardRewardPointsDto
{
    [Required]
    public Guid ResidentId { get; set; }

    [Required]
    public Guid PickupRequestId { get; set; }

    [Range(1, int.MaxValue)]
    public int PointsEarned { get; set; }

    [Required]
    [MaxLength(500)]
    public string Reason { get; set; } = string.Empty;
}

public class UpdateRewardPointDto
{
    public int PointsEarned { get; set; }

    [Required]
    [MaxLength(500)]
    public string Reason { get; set; } = string.Empty;
}

public class RedeemRewardPointsDto
{
    [Range(1, int.MaxValue)]
    public int Points { get; set; }

    [Required]
    [MaxLength(480)]
    public string Reason { get; set; } = string.Empty;
}

public class RewardPointResponseDto
{
    public Guid Id { get; set; }
    public Guid ResidentId { get; set; }
    public Guid? PickupRequestId { get; set; }   // null for redemptions
    public int PointsEarned { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class RewardHistoryResponseDto
{
    public Guid ResidentId { get; set; }
    public int CurrentBalance { get; set; }
    public IEnumerable<RewardPointResponseDto> Items { get; set; } = [];
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages => PageSize == 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

public class RewardHistoryQueryParams
{
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public string? SortDir { get; set; } = "desc";

    private int _page = 1;
    public int Page { get => _page; set => _page = value < 1 ? 1 : value; }

    private int _pageSize = 10;
    public int PageSize
    {
        get => _pageSize;
        set => _pageSize = value is < 1 or > 100 ? 10 : value;
    }
}

public class RewardLeaderboardEntryDto
{
    public int Rank { get; set; }
    public Guid ResidentId { get; set; }
    public string ResidentName { get; set; } = string.Empty;
    public int PointsEarned { get; set; }
}

public class RewardRedemptionResponseDto
{
    public RewardPointResponseDto Transaction { get; set; } = null!;
    public int RemainingBalance { get; set; }
}
