using backend.Models;

namespace backend.Services;

/// <summary>
/// Student 3 (Rewards &amp; Compliance) rules — evaluates a waste classification
/// and returns human-readable violation messages when admin review is required.
/// </summary>
public static class ComplianceRules
{
    public const double LowConfidenceThreshold = 0.70;

    public static IReadOnlyList<string> Evaluate(WasteCategory category, double confidence, string reasoning)
    {
        var violations = new List<string>();

        if (category is WasteCategory.Hazardous or WasteCategory.EWaste)
            violations.Add($"Restricted waste category detected: {category}");

        if (confidence < LowConfidenceThreshold)
            violations.Add($"Classification confidence too low ({confidence:P0}) — manual review required");

        if (ContainsMixedWasteIndicators(reasoning))
            violations.Add("Possible mixed or contaminated waste detected in classification reasoning");

        return violations;
    }

    private static bool ContainsMixedWasteIndicators(string reasoning)
    {
        var lower = reasoning.ToLowerInvariant();
        return lower.Contains("mixed")
            || lower.Contains("contamin")
            || lower.Contains("non-recyclable");
    }
}
