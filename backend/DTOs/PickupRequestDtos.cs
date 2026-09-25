using System.ComponentModel.DataAnnotations;
using backend.Models;

namespace backend.DTOs;

// What the resident sends to CREATE a request
public class CreatePickupRequestDto
{
    public string? PhotoUrl { get; set; }

    [MaxLength(1000)]
    public string? Description { get; set; }

    [Required]
    public DateTime PreferredDate { get; set; }

    public bool IsRecurring { get; set; } = false;
    public string? RecurrenceInterval { get; set; }
}

// What the resident sends to EDIT a pending request
public class UpdatePickupRequestDto
{
    public string? PhotoUrl { get; set; }

    [MaxLength(1000)]
    public string? Description { get; set; }

    [Required]
    public DateTime PreferredDate { get; set; }

    public bool IsRecurring { get; set; } = false;
    public string? RecurrenceInterval { get; set; }
}

// What the API RETURNS for a request (full detail)
public class PickupRequestResponseDto
{
    public Guid Id { get; set; }
    public Guid ResidentId { get; set; }
    public string? PhotoUrl { get; set; }
    public string? Description { get; set; }
    public DateTime PreferredDate { get; set; }
    public string Status { get; set; } = string.Empty;   // enum as string
    public bool IsRecurring { get; set; }
    public string? RecurrenceInterval { get; set; }
    public DateTime CreatedAt { get; set; }

    public Guid? ZoneId { get; set; }
    public string? ZoneName { get; set; }

    // --- What the agents decided, from the pickup's latest WasteClassification.
    // All null when the pickup has not been classified yet: either it is still
    // Pending, or the agent service was unavailable when it was submitted.

    /// <summary>Waste category as a string, e.g. "Hazardous" or "EWaste".</summary>
    public string? Category { get; set; }

    /// <summary>Classifier certainty, 0..1.</summary>
    public double? Confidence { get; set; }

    /// <summary>The classifier's one-sentence explanation of the category.</summary>
    public string? Reasoning { get; set; }

    /// <summary>When the classification was recorded.</summary>
    public DateTime? ClassifiedAt { get; set; }

    // --- Admin review, from the pickup's ApprovalRequest if one was raised.

    /// <summary>True when this pickup was flagged and needs (or had) admin review.</summary>
    public bool HasApprovalRequest { get; set; }

    /// <summary>"Pending", "Approved", "Rejected" or "RevisionRequested"; null if never flagged.</summary>
    public string? ApprovalStatus { get; set; }

    /// <summary>Why it was flagged; null if never flagged.</summary>
    public string? FlagReason { get; set; }

    /// <summary>The approval row's id, so the UI can link straight to the review screen.</summary>
    public Guid? ApprovalRequestId { get; set; }
}

// Lightweight shape for the status-check endpoint
public class PickupStatusDto
{
    public Guid Id { get; set; }
    public string Status { get; set; } = string.Empty;
}

// Returned by POST /api/pickuprequests/{id}/classify
public class ClassifyResponseDto
{
    public Guid PickupRequestId { get; set; }
    public string Category { get; set; } = string.Empty;   // e.g. "Recyclable"
    public double Confidence { get; set; }
    public string Status { get; set; } = string.Empty;     // new pickup status, e.g. "Classified"
}