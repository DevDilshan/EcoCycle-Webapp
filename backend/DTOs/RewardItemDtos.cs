using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

public class SaveRewardItemDto
{
    [Required]
    [MaxLength(120)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    [Range(1, 100000)]
    public int PointsCost { get; set; }

    // Leave empty for unlimited.
    [Range(0, 1000000)]
    public int? Stock { get; set; }

    public bool IsActive { get; set; } = true;
}

public class RewardItemResponseDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int PointsCost { get; set; }
    public int? Stock { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

// Bound from the query string on GET /api/reward-items
public class RewardItemQueryParams
{
    public bool? IsActive { get; set; }                // admins only; residents always get active items
    public string? Search { get; set; }                // name or description

    public string? SortBy { get; set; } = "pointsCost"; // name | pointsCost | createdAt
    public string? SortDir { get; set; } = "asc";       // asc | desc

    private int _page = 1;
    public int Page { get => _page; set => _page = value < 1 ? 1 : value; }

    private int _pageSize = 20;
    public int PageSize
    {
        get => _pageSize;
        set => _pageSize = value is < 1 or > 100 ? 20 : value;
    }
}
