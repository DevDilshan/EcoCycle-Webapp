using backend.DTOs;
using backend.Models;

namespace backend.Services.Rules;

// Student 3 Validator rules - plain code for Week 3, wrapped by the Validator Agent in Week 4.
public static class RewardRules
{
    public const string HazardousCategory = "HAZARDOUS_CATEGORY";
    public const string ExcessiveBulkPickups = "EXCESSIVE_BULK_PICKUPS";

    // Project plan: max 2 bulk pickups (furniture, appliances) per resident per month.
    public const WasteCategory BulkCategory = WasteCategory.Bulk;
    public const int MaxBulkPickupsPerMonth = 2;

    public static ValidationResultDto Evaluate(ValidationInput context)
    {
        var violated = new List<string>();

        if (context.Category == WasteCategory.Hazardous)
            violated.Add(HazardousCategory);

        if (context.Category == BulkCategory
            && context.BulkPickupsThisMonth > MaxBulkPickupsPerMonth)
            violated.Add(ExcessiveBulkPickups);

        return new ValidationResultDto { ViolatedRules = violated };
    }
}
