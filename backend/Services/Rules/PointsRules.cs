using backend.Models;

namespace backend.Services.Rules;

// Deterministic points calculation for a collected pickup. Plain if/else on
// purpose: the marks a resident earns must be explainable and repeatable, so
// no AI is involved in deciding them.
public static class PointsRules
{
    // A resident with this many past violations on record earns reduced points.
    public const int PenaltyViolationThreshold = 3;

    // Reduced points are the base points divided by this, never below 1.
    public const int PenaltyDivisor = 2;

    public static int BasePoints(WasteCategory category) => category switch
    {
        WasteCategory.Recyclable => 5,
        WasteCategory.Organic => 3,
        WasteCategory.EWaste => 8,
        WasteCategory.Bulk => 4,
        // Restricted waste that made it through the approval flow and was
        // collected properly earns the most.
        WasteCategory.Hazardous => 10,
        WasteCategory.General => 1,
        _ => 0
    };

    public static bool HasPenalty(int priorViolations) =>
        priorViolations >= PenaltyViolationThreshold;

    public static int Calculate(WasteCategory category, int priorViolations)
    {
        var points = BasePoints(category);
        if (points == 0 || !HasPenalty(priorViolations))
            return points;

        return Math.Max(1, points / PenaltyDivisor);
    }

    public static string Reason(WasteCategory category, int priorViolations) =>
        HasPenalty(priorViolations)
            ? $"Pickup completed: {category} (reduced: {priorViolations} past violations)"
            : $"Pickup completed: {category}";
}
