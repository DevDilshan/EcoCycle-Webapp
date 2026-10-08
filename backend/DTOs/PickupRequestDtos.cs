using System.ComponentModel.DataAnnotations;
using backend.Models;
using backend.Validation;

namespace backend.DTOs;

// What the resident sends to CREATE a request
public class CreatePickupRequestDto : IValidatableObject
{
    [StringLength(2048, ErrorMessage = "Photo URL is too long.")]
    [Url(ErrorMessage = "Photo URL must be a valid URL.")]
    public string? PhotoUrl { get; set; }

    public string? Description { get; set; }

    /// <summary>
    /// House number and street. Required: the zone is a whole suburb, so
    /// without this a collector has nowhere to go.
    /// </summary>
    [Required(ErrorMessage = "Address is required so the collector can find you.")]
    [StringLength(300, MinimumLength = 5, ErrorMessage = "Please give a full address.")]
    public string Address { get; set; } = string.Empty;

    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    /// <summary>
    /// A number the crew can call on the day.
    /// </summary>
    /// <remarks>
    /// Required, for the same reason the address is: an address can be wrong or
    /// hard to find, and a call from the kerb is the only way to resolve it
    /// without the stop being written off as missed.
    ///
    /// Deliberately not taken from the resident's profile. The person to call is
    /// whoever will be at the collection, which is not always the account holder.
    /// </remarks>
    [Required(ErrorMessage = "A contact number is required so the crew can reach you.")]
    [StringLength(20, ErrorMessage = "Contact number is too long.")]
    public string ContactPhone { get; set; } = string.Empty;

    public DateTime PreferredDate { get; set; }

    /// <summary>
    /// The zone the pickup is in, chosen by the resident.
    /// </summary>
    /// <remarks>
    /// Required. Every pickup used to land in the oldest active zone regardless
    /// of where the resident was, which made zone-based routing meaningless.
    /// </remarks>
    [Required(ErrorMessage = "Zone is required.")]
    public Guid ZoneId { get; set; }

    /// <summary>
    /// The resident is booking a bulky-waste collection, which draws on their
    /// monthly allowance. Enforced on this declaration, not on the classifier.
    /// </summary>
    public bool IsBulkRequest { get; set; } = false;

    public bool IsRecurring { get; set; } = false;
    public string? RecurrenceInterval { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in PickupRequestValidation.Validate(
            Description, PreferredDate, IsRecurring, RecurrenceInterval))
            yield return result;

        foreach (var result in PickupLocationValidation.Validate(Latitude, Longitude))
            yield return result;

        if (!string.IsNullOrWhiteSpace(ContactPhone) && !PickupRequestValidation.IsDialable(ContactPhone))
            yield return new ValidationResult(
                "Phone number must be 10 digits starting with 0, e.g. 0771234567.",
                new[] { "contactPhone" });
    }
}

// What the resident sends to EDIT a pending request
public class UpdatePickupRequestDto : IValidatableObject
{
    public bool ClearLocation { get; set; }
    [StringLength(2048, ErrorMessage = "Photo URL is too long.")]
    [Url(ErrorMessage = "Photo URL must be a valid URL.")]
    public string? PhotoUrl { get; set; }

    public string? Description { get; set; }

    [StringLength(300, MinimumLength = 5, ErrorMessage = "Please give a full address.")]
    public string? Address { get; set; }

    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    /// <summary>
    /// Optional on edit: left null, the stored number is kept.
    /// </summary>
    [StringLength(20, ErrorMessage = "Contact number is too long.")]
    public string? ContactPhone { get; set; }

    public DateTime PreferredDate { get; set; }

    public bool IsRecurring { get; set; } = false;
    public string? RecurrenceInterval { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in PickupRequestValidation.Validate(
            Description, PreferredDate, IsRecurring, RecurrenceInterval))
            yield return result;

        foreach (var result in PickupLocationValidation.Validate(Latitude, Longitude))
            yield return result;

        // Only when supplied: omitting it on an edit keeps the stored number.
        if (!string.IsNullOrWhiteSpace(ContactPhone) && !PickupRequestValidation.IsDialable(ContactPhone))
            yield return new ValidationResult(
                "Phone number must be 10 digits starting with 0, e.g. 0771234567.",
                new[] { "contactPhone" });
    }
}

// What the API RETURNS for a request (full detail)
public class PickupRequestResponseDto
{
    public Guid Id { get; set; }
    public Guid ResidentId { get; set; }
    public string? PhotoUrl { get; set; }
    public string? Description { get; set; }
    public string? Address { get; set; }

    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    /// <summary>
    /// The number the crew calls. Null on requests made before this was
    /// collected.
    /// </summary>
    public string? ContactPhone { get; set; }

    public DateTime PreferredDate { get; set; }
    public string Status { get; set; } = string.Empty;   // enum as string
    /// <summary>
    /// What happened at the most recent attempt: "Pending", "Completed" or
    /// "Missed". Null when nothing has been scheduled yet.
    /// </summary>
    /// <remarks>
    /// Carried on the pickup rather than sent as a notification. There is no
    /// inbox in this app, and a status cannot go stale the way a stored message
    /// can -- "we missed you on the 2nd" would still be sitting there after it
    /// had been collected.
    /// </remarks>
    public string? LastAttemptStatus { get; set; }

    /// <summary>The collector's own words about why it could not be collected.</summary>
    public string? LastAttemptNote { get; set; }

    /// <summary>When that attempt was.</summary>
    public DateTime? LastAttemptDate { get; set; }

    /// <summary>The next booked visit, when one exists.</summary>
    public DateTime? NextVisitDate { get; set; }

    /// <summary>
    /// The message written for the resident after a failed attempt, in plain
    /// language rather than the collector's shorthand.
    /// </summary>
    public string? ResidentMessage { get; set; }

    public bool IsBulkRequest { get; set; }

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

    /// <summary>Admin notes or rejection reason from the latest approval review.</summary>
    public string? ApprovalReviewNotes { get; set; }

    /// <summary>When the latest approval was approved or rejected.</summary>
    public DateTime? ApprovalReviewedAt { get; set; }
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
/// <summary>
/// A resident's bulky-waste allowance for the current calendar month, so the
/// submit form can show it before they book rather than refusing afterwards.
/// </summary>
public class BulkAllowanceDto
{
    public int Limit { get; set; }
    public int Used { get; set; }
    public int Remaining { get; set; }
}
