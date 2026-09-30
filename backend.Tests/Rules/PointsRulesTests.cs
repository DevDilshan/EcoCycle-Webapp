using backend.Models;
using backend.Services.Rules;

namespace backend.Tests.Rules;

public class PointsRulesTests
{
    [Theory]
    [InlineData(WasteCategory.Recyclable, 5)]
    [InlineData(WasteCategory.Organic, 3)]
    [InlineData(WasteCategory.Hazardous, 10)]
    [InlineData(WasteCategory.EWaste, 8)]
    [InlineData(WasteCategory.Bulk, 4)]
    [InlineData(WasteCategory.General, 1)]
    public void Clean_record_earns_the_base_points_for_the_category(WasteCategory category, int expected) =>
        Assert.Equal(expected, PointsRules.Calculate(category, priorViolations: 0));

    [Fact]
    public void Two_past_violations_do_not_reduce_points() =>
        Assert.Equal(5, PointsRules.Calculate(WasteCategory.Recyclable, priorViolations: 2));

    [Fact]
    public void Three_past_violations_halve_the_points() =>
        Assert.Equal(2, PointsRules.Calculate(WasteCategory.Recyclable, priorViolations: 3));

    [Fact]
    public void Reduced_points_never_drop_below_one() =>
        Assert.Equal(1, PointsRules.Calculate(WasteCategory.General, priorViolations: 10));

    [Fact]
    public void Reason_mentions_the_reduction_only_when_it_applied()
    {
        Assert.Equal("Pickup completed: Organic", PointsRules.Reason(WasteCategory.Organic, 0));
        Assert.Contains("reduced", PointsRules.Reason(WasteCategory.Organic, 4));
    }
}
