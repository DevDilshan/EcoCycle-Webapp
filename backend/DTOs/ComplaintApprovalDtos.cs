using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
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
    [JsonConverter(typeof(JsonStringEnumConverter))]
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

// Bound from the query string on GET /api/approvals
public class ApprovalQueryParams
{
    public ApprovalStatus? Status { get; set; }        // ?status=Pending

    private int _page = 1;
    public int Page { get => _page; set => _page = value < 1 ? 1 : value; }

    private int _pageSize = 10;
    public int PageSize
    {
        get => _pageSize;
        set => _pageSize = value is < 1 or > 100 ? 10 : value; // clamp 1..100
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

/// <summary>
/// One approval plus what the agents decided, for the admin review screen.
/// </summary>
public class ApprovalDetailDto : ApprovalResponseDto
{
    /// <summary>
    /// Null when the approval has no stored agent result (it predates the agent
    /// pipeline) or the stored JSON could not be read -- see AgentResultNote.
    /// </summary>
    public AgentInsightDto? AgentInsight { get; set; }

    /// <summary>Set only when AgentInsight is null, explaining why.</summary>
    public string? AgentResultNote { get; set; }
}

/// <summary>
/// The parts of a pipeline result an admin needs in order to decide, lifted out
/// of the stored JSON so the dashboard does not have to parse it.
/// </summary>
public class AgentInsightDto
{
    public string Category { get; set; } = string.Empty;
    public double Confidence { get; set; }
    public string ClassificationReasoning { get; set; } = string.Empty;

    /// <summary>True when the classifier could see the resident's photo.</summary>
    public bool ImageUsed { get; set; }

    /// <summary>Rule codes the validator broke, e.g. ["HAZARDOUS_CATEGORY"].</summary>
    public List<string> ViolatedRules { get; set; } = [];

    /// <summary>"approve", "reject" or "request_revision"; null if not flagged.</summary>
    public string? Recommendation { get; set; }
    public string? AdminSummary { get; set; }

    /// <summary>Draft message for the resident, for the admin to send or edit.</summary>
    public string? ResidentNotification { get; set; }

    /// <summary>Why the notifier recommended what it did.</summary>
    public string? RecommendationReasoning { get; set; }
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

    /// <summary>
    /// Null when the approval went through cleanly. Set when the approval itself
    /// was saved but the pickup could not be assigned a collector, so the admin
    /// knows to retry rather than assuming it is scheduled.
    /// </summary>
    public string? RoutingWarning { get; set; }
}
