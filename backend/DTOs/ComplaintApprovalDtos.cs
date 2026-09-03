using System.ComponentModel.DataAnnotations;
using backend.Models;

namespace backend.DTOs;

public class CreateComplaintDto
{
    [Required]
    public Guid PickupRequestId { get; set; }

    [Required]
    [MaxLength(2000)]
    public string Description { get; set; } = string.Empty;
}

public class UpdateComplaintDto
{
    [Required]
    public ComplaintStatus Status { get; set; }

    [MaxLength(2000)]
    public string? AdminNotes { get; set; }
}

public class ComplaintResponseDto
{
    public Guid Id { get; set; }
    public Guid ResidentId { get; set; }
    public Guid PickupRequestId { get; set; }
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? AdminNotes { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ComplaintQueryParams
{
    public ComplaintStatus? Status { get; set; }

    public string? SortBy { get; set; } = "createdAt";
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

public class RejectApprovalDto
{
    [Required]
    [MaxLength(2000)]
    public string Reason { get; set; } = string.Empty;
}

public class ApproveApprovalDto
{
    [MaxLength(2000)]
    public string? Notes { get; set; }
}

public class ApprovalResponseDto
{
    public Guid Id { get; set; }
    public Guid PickupRequestId { get; set; }
    public string FlagReason { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public Guid? ReviewedByAdminId { get; set; }
    public string? ReviewNotes { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}
