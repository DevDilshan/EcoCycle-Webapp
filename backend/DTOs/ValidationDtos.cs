using backend.Models;

namespace backend.DTOs;

// What the rules engine needs to know about one pickup.
public class ValidationInput
{
    public WasteCategory Category { get; set; }

    // Bulk pickups by this resident in the current UTC month, including this one.
    public int BulkPickupsThisMonth { get; set; }
}

// Same shape the Week 4 Validator Agent will return.
public class ValidationResultDto
{
    public Guid PickupRequestId { get; set; }
    public bool IsValid => ViolatedRules.Count == 0;
    public IReadOnlyList<string> ViolatedRules { get; set; } = [];
    public bool RequiresApproval => !IsValid;
}
