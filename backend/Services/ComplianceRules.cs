using System.Text.RegularExpressions;
using backend.Models;

namespace backend.Services;

/// <summary>
/// Student 3 (Rewards &amp; Compliance) rules — evaluates a waste classification
/// and returns human-readable violation messages when admin review is required.
/// </summary>
public static class ComplianceRules
{
    public const double LowConfidenceThreshold = 0.70;

    // Mixed-waste wording, skipped when negated ("no contamination", "not mixed", "free of ...").
    // The leading \b also keeps words like "uncontaminated" from matching.
    private static readonly Regex MixedWasteIndicators = new(
        @"(?<!\b(?:no|not|without|free\s+of)\s+)\b(?:mixed|contaminat\w*|non-recyclable)",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);

    public static IReadOnlyList<ComplianceFinding> Evaluate(WasteCategory category, double confidence, string reasoning)
    {
        var findings = new List<ComplianceFinding>();

        if (category is WasteCategory.Hazardous or WasteCategory.EWaste)
            findings.Add(new($"Restricted waste category detected: {category}", ChargedToResident: true));

        // A low-confidence result is the classifier being unsure, not something the resident did:
        // it still needs admin review, but it doesn't go on the resident's compliance record.
        if (confidence < LowConfidenceThreshold)
            findings.Add(new($"Classification confidence too low ({confidence:P0}) — manual review required", ChargedToResident: false));

        if (MixedWasteIndicators.IsMatch(reasoning))
            findings.Add(new("Possible mixed or contaminated waste detected in classification reasoning", ChargedToResident: true));

        return findings;
    }
}

public record ComplianceFinding(string Message, bool ChargedToResident);
