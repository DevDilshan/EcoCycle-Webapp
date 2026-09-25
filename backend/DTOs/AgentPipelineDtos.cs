using System.Text.Json.Serialization;

namespace backend.DTOs;

// Wire contract for the Python agent service (FastAPI, agentic-ai/api.py).
// Python emits snake_case; the client configures SnakeCaseLower naming so these
// stay idiomatic C#. Property names must not be renamed without checking
// orchestrator.py, which owns this shape.

public class RunPipelineRequestDto
{
    public string Description { get; set; } = string.Empty;
    public string ResidentZoneId { get; set; } = string.Empty;

    // collector id -> pickups currently assigned to them.
    public Dictionary<string, int> CollectorLoads { get; set; } = new();

    public string? PhotoUrl { get; set; }
    public List<ResidentHistoryEntryDto>? ResidentHistory { get; set; }
    public string? ComplaintDescription { get; set; }
}

public class ResidentHistoryEntryDto
{
    public string Category { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class PipelineResultDto
{
    public ClassificationDto Classification { get; set; } = new();
    public ValidationDto Validation { get; set; } = new();

    /// Null when a business rule was broken: the pipeline deliberately does not
    /// assign a collector to a pickup that cannot go ahead. Assigned later by
    /// /route-approved-pickup once an admin approves.
    public RoutingDto? Routing { get; set; }

    public ApprovalDto? Approval { get; set; }
    public string? FlagReason { get; set; }
    public bool RequiresApproval { get; set; }

    /// The response body exactly as Python sent it, kept for
    /// ApprovalRequest.PipelineResultJson. Not part of the wire contract.
    [JsonIgnore]
    public string RawJson { get; set; } = string.Empty;
}

public class ClassificationDto
{
    public string Category { get; set; } = string.Empty;
    public double Confidence { get; set; }
    public string Reasoning { get; set; } = string.Empty;
    public bool ImageUsed { get; set; }
}

public class ValidationDto
{
    public bool IsValid { get; set; }
    public List<string> ViolatedRules { get; set; } = [];
    public bool RequiresApproval { get; set; }
}

public class RoutingDto
{
    public string CollectorId { get; set; } = string.Empty;
    public string ScheduledDate { get; set; } = string.Empty;   // "YYYY-MM-DD"
    public string ZoneId { get; set; } = string.Empty;
    public string Reasoning { get; set; } = string.Empty;
}

public class ApprovalDto
{
    public string Recommendation { get; set; } = string.Empty;  // approve | reject | request_revision
    public string AdminSummary { get; set; } = string.Empty;
    public string ResidentNotification { get; set; } = string.Empty;
    public string Reasoning { get; set; } = string.Empty;
}

public class RouteApprovedPickupRequestDto
{
    public Dictionary<string, object> PickupRequest { get; set; } = new();

    /// The stored PipelineResultJson, passed back verbatim as parsed JSON.
    public object PipelineResult { get; set; } = new();

    /// Loads as they are NOW, not the snapshot taken at submission.
    public Dictionary<string, int> CollectorLoads { get; set; } = new();
}
