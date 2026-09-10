using System.ComponentModel.DataAnnotations;
using backend.Models;

namespace backend.DTOs;

/// <summary>
/// Fake/simulated AI classification input for manual testing.
/// </summary>
public class ClassifyPickupRequestDto
{
    [Required]
    public WasteCategory Category { get; set; }

    [Required]
    [Range(0, 1)]
    public double Confidence { get; set; }

    [Required]
    [MaxLength(2000)]
    public string Reasoning { get; set; } = string.Empty;
}

public class ClassificationResultDto
{
    public Guid PickupRequestId { get; set; }
    public string PickupStatus { get; set; } = string.Empty;
    public Guid ClassificationId { get; set; }
    public bool Flagged { get; set; }
    public IReadOnlyList<string> Violations { get; set; } = Array.Empty<string>();
    public ApprovalResponseDto? ApprovalRequest { get; set; }
}
